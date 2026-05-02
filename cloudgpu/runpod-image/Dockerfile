FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

# Only 3 packages needed — python + pip already included in this image
RUN apt-get update && apt-get install -y --no-install-recommends \
    git wget curl \
    && rm -rf /var/lib/apt/lists/*

# PyTorch 2.3 with CUDA 12.1 runtime bundled
RUN pip install --no-cache-dir \
    torch==2.3.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI
RUN pip install --no-cache-dir -r /workspace/ComfyUI/requirements.txt

RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git \
    /workspace/ComfyUI/custom_nodes/ComfyUI-Manager && \
    pip install --no-cache-dir \
    -r /workspace/ComfyUI/custom_nodes/ComfyUI-Manager/requirements.txt

RUN mkdir -p \
    /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/vae \
    /workspace/ComfyUI/models/clip \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/output \
    /workspace/ComfyUI/user/default/workflows

RUN wget -q -O /workspace/ComfyUI/models/vae/sdxl_vae.safetensors \
    "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors"

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 8188
CMD ["/startup.sh"]
