import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

export const defaultPython = join(
  projectRoot,
  '.venv-corrosion',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

export const defaultWeights = join(
  projectRoot,
  'experiments/corrosion/weights/l2_loss_weights_35.pt',
);
