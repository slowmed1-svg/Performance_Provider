# CloudGPU — ComfyUI image for RunPod
# Base: Official PyTorch image with CUDA 12.1 + cuDNN 8
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-devel

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /workspace

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git wget curl libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI
RUN pip install --no-cache-dir -r /workspace/ComfyUI/requirements.txt

# Install popular custom nodes
RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git \
    /workspace/ComfyUI/custom_nodes/ComfyUI-Manager && \
    pip install --no-cache-dir -r /workspace/ComfyUI/custom_nodes/ComfyUI-Manager/requirements.txt

# Create model directories
RUN mkdir -p \
    /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/vae \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/models/upscale_models \
    /workspace/ComfyUI/output

# Download SDXL VAE (small, always useful, ~335MB)
RUN wget -q -O /workspace/ComfyUI/models/vae/sdxl_vae.safetensors \
    "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors"

# NOTE: Large model checkpoints (Flux, SDXL) are downloaded on first run via startup.sh
# to keep image size small. They are cached in RunPod's network volume if configured.

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 8188

CMD ["/startup.sh"]
