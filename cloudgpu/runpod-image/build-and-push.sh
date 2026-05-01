#!/bin/bash
# Build the ComfyUI Docker image and push to DockerHub.
# Run this once from your local machine, then use the image tag in RunPod.

DOCKERHUB_USER="${1:-your-dockerhub-username}"
IMAGE_NAME="$DOCKERHUB_USER/cloudgpu-comfyui"
TAG="latest"

echo "Building $IMAGE_NAME:$TAG ..."
docker build --platform linux/amd64 -t "$IMAGE_NAME:$TAG" .

echo "Pushing to DockerHub..."
docker push "$IMAGE_NAME:$TAG"

echo ""
echo "Done. Set this in your backend .env:"
echo "  RUNPOD_IMAGE_NAME=$IMAGE_NAME:$TAG"
echo ""
echo "Then create a RunPod template using this image."
