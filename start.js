import http from 'http';

const PORT = parseInt(process.env.PORT || '5000', 10);
let expressApp = null;

const server = http.createServer((req, res) => {
  if (expressApp) {
    expressApp(req, res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log('Running on port ' + PORT);
  process.env.DEFER_LISTEN = '1';
  try {
    const mod = await import('./server.js');
    expressApp = mod.app;
    console.log('App ready');
  } catch(e) {
    console.error('App load failed:', e);
  }
});
