# Kasm is NOT used in the MVP.
# Sessions use the RunPod proxy URL (https://{pod_id}-8188.proxy.runpod.net) directly.
# This module is kept as a stub for the future phase where a persistent Kasm
# instance delivers a full Windows desktop (SolidWorks, AutoCAD etc.).

async def destroy_session(kasm_session_id: str) -> bool:
    """No-op for MVP — pod is terminated via RunPod directly."""
    return True
