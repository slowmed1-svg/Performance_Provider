# CloudGPU — ComfyUI image for RunPod
# Ubuntu 22.04 base — PyTorch wheels include CUDA runtime, no nvidia base needed
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

# Minimal system deps — all available in standard Ubuntu 22.04 repos
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev \
    git wget curl \
    libgl1 libglib2.0-0 \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# PyTorch 2.3 + CUDA 12.1 runtime (bundled inside the wheel — no nvidia base needed)
RUN pip install --no-cache-dir \
    torch==2.3.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

# ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI
RUN pip install --no-cache-dir -r /workspace/ComfyUI/requirements.txt

# ComfyUI Manager
RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git \
    /workspace/ComfyUI/custom_nodes/ComfyUI-Manager && \
    pip install --no-cache-dir \
    -r /workspace/ComfyUI/custom_nodes/ComfyUI-Manager/requirements.txt

# Model directories
RUN mkdir -p \
    /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/vae \
    /workspace/ComfyUI/models/clip \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/output \
    /workspace/ComfyUI/user/default/workflows

# SDXL VAE (~335MB)
RUN wget -q -O /workspace/ComfyUI/models/vae/sdxl_vae.safetensors \
    "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors"

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 8188
CMD ["/startup.sh"]
