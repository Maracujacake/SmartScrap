import '../server/config.js';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

// Serve the built frontend and API together, including photographs, on one port.
const build = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  windowsHide: true,
});
let server,
  stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  build.kill();
  server?.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
build.on('error', (error) => {
  console.error(error.message);
  stop(1);
});
build.on('exit', (code) => {
  if (stopping) return;
  if (code !== 0) {
    stop(code || 1);
    return;
  }
  const port = process.env.PORT || '3001';
  console.log('\nSmartScrap disponível para a rede local. Mantenha este computador ligado.');
  console.log(`Neste computador: http://127.0.0.1:${port}`);
  for (const [name, addresses] of Object.entries(networkInterfaces()))
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
        console.log(`Rede ${name}: http://${address.address}:${port}`);
    }
  console.log('Outros dispositivos devem usar o endereço da rede Wi-Fi/Ethernet, não 127.0.0.1.');
  console.log(
    'Se o Windows perguntar, permita acesso apenas na rede privada confiável. Ctrl+C encerra.\n',
  );
  server = spawn(process.execPath, ['server/index.js'], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, HOST: '0.0.0.0', COOKIE_SECURE: 'false' },
  });
  server.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  server.on('exit', (code) => stop(code || 0));
});
