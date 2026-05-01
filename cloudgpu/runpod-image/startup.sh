#!/bin/bash
set -e

COMFYUI_DIR="/workspace/ComfyUI"
MODELS_DIR="$COMFYUI_DIR/models/checkpoints"

echo "[CloudGPU] Starting session..."
echo "[CloudGPU] GPU: $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo 'no GPU info')"

# ── Model download (only if not already present) ────────────────────────────
# Using Flux Schnell — fast generation, good quality, Apache 2.0 license.
# ~16GB download on first run; subsequent runs use RunPod network volume cache.

FLUX_MODEL="$MODELS_DIR/flux1-schnell-fp8.safetensors"
if [ ! -f "$FLUX_MODEL" ]; then
    echo "[CloudGPU] Downloading Flux Schnell (fp8, ~8GB)..."
    wget -q --show-progress \
        -O "$FLUX_MODEL" \
        "https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors"
    echo "[CloudGPU] Flux Schnell downloaded."
else
    echo "[CloudGPU] Flux Schnell already present, skipping download."
fi

# Download Flux text encoders if not present
CLIP_L="$COMFYUI_DIR/models/clip/clip_l.safetensors"
T5="$COMFYUI_DIR/models/clip/t5xxl_fp8_e4m3fn.safetensors"
mkdir -p "$COMFYUI_DIR/models/clip"

if [ ! -f "$CLIP_L" ]; then
    echo "[CloudGPU] Downloading CLIP-L encoder..."
    wget -q -O "$CLIP_L" \
        "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"
fi

if [ ! -f "$T5" ]; then
    echo "[CloudGPU] Downloading T5 encoder (fp8)..."
    wget -q -O "$T5" \
        "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors"
fi

# ── Write the default Flux workflow so it loads on startup ──────────────────
cat > "$COMFYUI_DIR/user/default/workflows/flux-schnell.json" << 'WORKFLOW'
{
  "last_node_id": 9,
  "last_link_id": 9,
  "nodes": [
    {"id":6,"type":"CLIPTextEncode","pos":[415,186],"size":{"0":422,"1":164},"flags":{},"order":2,"mode":0,"inputs":[{"name":"clip","type":"CLIP","link":3}],"outputs":[{"name":"CONDITIONING","type":"CONDITIONING","links":[4],"slot_index":0}],"properties":{"Node name for S&R":"CLIPTextEncode"},"widgets_values":["a photorealistic portrait, dramatic lighting, ultra detailed"]},
    {"id":7,"type":"CLIPTextEncode","pos":[415,396],"size":{"0":422,"1":164},"flags":{},"order":3,"mode":0,"inputs":[{"name":"clip","type":"CLIP","link":3}],"outputs":[{"name":"CONDITIONING","type":"CONDITIONING","links":[6],"slot_index":0}],"properties":{"Node name for S&R":"CLIPTextEncode"},"widgets_values":["bad quality, blurry, watermark"]},
    {"id":4,"type":"CheckpointLoaderSimple","pos":[26,474],"size":{"0":315,"1":98},"flags":{},"order":0,"mode":0,"outputs":[{"name":"MODEL","type":"MODEL","links":[1]},{"name":"CLIP","type":"CLIP","links":[3,3]},{"name":"VAE","type":"VAE","links":[8]}],"properties":{"Node name for S&R":"CheckpointLoaderSimple"},"widgets_values":["flux1-schnell-fp8.safetensors"]},
    {"id":3,"type":"KSampler","pos":[863,186],"size":{"0":315,"1":262},"flags":{},"order":4,"mode":0,"inputs":[{"name":"model","type":"MODEL","link":1},{"name":"positive","type":"CONDITIONING","link":4},{"name":"negative","type":"CONDITIONING","link":6},{"name":"latent_image","type":"LATENT","link":2}],"outputs":[{"name":"LATENT","type":"LATENT","links":[7]}],"properties":{"Node name for S&R":"KSampler"},"widgets_values":[42,"fixed",4,"euler","simple",1.0]},
    {"id":5,"type":"EmptyLatentImage","pos":[473,609],"size":{"0":315,"1":106},"flags":{},"order":1,"mode":0,"outputs":[{"name":"LATENT","type":"LATENT","links":[2]}],"properties":{"Node name for S&R":"EmptyLatentImage"},"widgets_values":[1024,1024,1]},
    {"id":8,"type":"VAEDecode","pos":[1209,186],"size":{"0":210,"1":46},"flags":{},"order":5,"mode":0,"inputs":[{"name":"samples","type":"LATENT","link":7},{"name":"vae","type":"VAE","link":8}],"outputs":[{"name":"IMAGE","type":"IMAGE","links":[9]}],"properties":{"Node name for S&R":"VAEDecode"}},
    {"id":9,"type":"SaveImage","pos":[1451,186],"size":{"0":210,"1":270},"flags":{},"order":6,"mode":0,"inputs":[{"name":"images","type":"IMAGE","link":9}],"properties":{"Node name for S&R":"SaveImage"},"widgets_values":["ComfyUI"]}
  ],
  "links":[[1,4,0,3,0,"MODEL"],[2,5,0,3,3,"LATENT"],[3,4,1,6,0,"CLIP"],[3,4,1,7,0,"CLIP"],[4,6,0,3,1,"CONDITIONING"],[6,7,0,3,2,"CONDITIONING"],[7,3,0,8,0,"LATENT"],[8,4,2,8,1,"VAE"],[9,8,0,9,0,"IMAGE"]],
  "groups":[],
  "config":{},
  "extra":{"ds":{"scale":0.8129746337890625,"offset":[0,0]}},
  "version":0.4
}
WORKFLOW

# ── Launch ComfyUI ───────────────────────────────────────────────────────────
echo "[CloudGPU] Starting ComfyUI on port 8188..."
cd "$COMFYUI_DIR"
exec python main.py \
    --listen 0.0.0.0 \
    --port 8188 \
    --enable-cors-header \
    --preview-method auto
