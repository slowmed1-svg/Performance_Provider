import httpx
import asyncio
from app.config import get_settings

settings = get_settings()

RUNPOD_GQL = "https://api.runpod.io/graphql"


def _headers():
    return {"Authorization": f"Bearer {settings.runpod_api_key}", "Content-Type": "application/json"}


def pod_proxy_url(pod_id: str, port: int) -> str:
    """Build the RunPod HTTPS proxy URL for a given pod port."""
    return f"https://{pod_id}-{port}.proxy.runpod.net"


async def deploy_pod() -> dict:
    """Launch a GPU pod. Returns the full pod object including id."""
    query = """
    mutation DeployPod($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) {
        id
        desiredStatus
        imageName
      }
    }
    """
    variables = {
        "input": {
            "gpuCount": 1,
            "volumeInGb": 30,
            "containerDiskInGb": 30,
            "minVcpuCount": 4,
            "minMemoryInGb": 16,
            "gpuTypeId": settings.runpod_gpu_type,
            "name": "cloudgpu-session",
            "imageName": settings.runpod_image_name,
            "ports": "8188/http",
            "startSsh": False,
            "env": [{"key": "COMFY_ARGS", "value": "--listen 0.0.0.0 --port 8188"}],
        }
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(RUNPOD_GQL, json={"query": query, "variables": variables}, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"RunPod deploy error: {data['errors']}")
        return data["data"]["podFindAndDeployOnDemand"]


async def get_pod_status(pod_id: str) -> dict:
    """Returns pod status. Relevant fields: desiredStatus, runtime."""
    query = """
    query PodStatus($podId: String!) {
      pod(input: { podId: $podId }) {
        id
        desiredStatus
        runtime {
          uptimeInSeconds
          ports {
            ip
            isIpPublic
            privatePort
            publicPort
            type
          }
        }
      }
    }
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(RUNPOD_GQL, json={"query": query, "variables": {"podId": pod_id}}, headers=_headers())
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"RunPod status error: {data['errors']}")
        return data["data"]["pod"]


async def terminate_pod(pod_id: str) -> bool:
    """Terminate a pod. Returns True on success."""
    query = """
    mutation TerminatePod($podId: String!) {
      podTerminate(input: { podId: $podId })
    }
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(RUNPOD_GQL, json={"query": query, "variables": {"podId": pod_id}}, headers=_headers())
        resp.raise_for_status()
        return True


async def wait_for_comfyui(pod_id: str, timeout_seconds: int = 180, poll_interval: int = 5) -> str | None:
    """
    Poll RunPod until pod is RUNNING, then verify ComfyUI is serving HTTP.
    Returns the ComfyUI URL on success, None on timeout.
    """
    comfyui_url = pod_proxy_url(pod_id, 8188)
    elapsed = 0

    while elapsed < timeout_seconds:
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

        try:
            pod = await get_pod_status(pod_id)
            if pod.get("desiredStatus") != "RUNNING" or not pod.get("runtime"):
                continue

            # Pod is RUNNING — now check if ComfyUI is actually serving
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(comfyui_url, follow_redirects=True)
                if resp.status_code < 500:
                    return comfyui_url
        except Exception:
            pass  # Keep polling

    return None
