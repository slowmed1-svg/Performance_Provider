# CloudGPU — ComfyUI image for RunPod
# Base: Official NVIDIA CUDA 12.1 on Ubuntu 22.04 (clean, reliable apt sources)
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

# System deps + Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip \
    git wget curl \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch 2.3 with CUDA 12.1
RUN pip install --no-cache-dir \
    torch==2.3.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

# Install ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI
RUN pip install --no-cache-dir -r /workspace/ComfyUI/requirements.txt

# Install ComfyUI Manager
RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git \
    /workspace/ComfyUI/custom_nodes/ComfyUI-Manager && \
    pip install --no-cache-dir -r /workspace/ComfyUI/custom_nodes/ComfyUI-Manager/requirements.txt

# Create model directories
RUN mkdir -p \
    /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/vae \
    /workspace/ComfyUI/models/clip \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/models/upscale_models \
    /workspace/ComfyUI/output \
    /workspace/ComfyUI/user/default/workflows

# Download SDXL VAE (~335MB — small enough to bake into image)
RUN wget -q --show-progress \
    -O /workspace/ComfyUI/models/vae/sdxl_vae.safetensors \
    "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors"

# Large models (Flux Schnell ~8GB) are downloaded at container startup
# and cached on a RunPod Network Volume to avoid re-downloading each session

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 8188

CMD ["/startup.sh"]
