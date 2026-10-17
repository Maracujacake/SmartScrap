# Original model implementation

Source: https://github.com/beric7/corrosion_cs_classification

The `network` directory was copied from `Training - Testing/network` in the
author's source archive. The original MIT license is retained in `LICENSE`.

Downloaded source ZIP SHA-256:
`f92dabe575ef91fd59ae68ba8d7c82bfcf71b7acdd459700fc64b348e17f24d9`

Compatibility edits, without changing the network or its learned weights:

- `network/backbone/resnet.py` and `network/backbone/mobilenetv2.py`: changed the
  removed `torchvision.models.utils.load_state_dict_from_url` import to the
  supported `torch.hub.load_state_dict_from_url`.

The original evaluation code uses 512x512 BGR images with floating-point pixel
values in 0–255, without ImageNet normalization. The local inference script
preserves this preprocessing and uses CPU/evaluation/inference mode.

The official checkpoint is a serialized full model. Loading uses
`weights_only=True` with a fixed allowlist of the reviewed model classes and
standard PyTorch layers. No unrestricted pickle loading is used.
