const { exec } = require('child_process');

console.log('Starting build test...');

const buildProcess = exec('npx react-scripts build', (error, stdout, stderr) => {
  if (error) {
    console.error('Build error:', error);
    console.error('Error output:', stderr);
    return;
  }
  
  console.log('Build successful!');
  console.log('Output:', stdout);
});

buildProcess.stdout.on('data', (data) => {
  console.log('STDOUT:', data);
});

buildProcess.stderr.on('data', (data) => {
  console.error('STDERR:', data);
});

buildProcess.on('close', (code) => {
  console.log(`Build process exited with code ${code}`);
});
