const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edge = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-sandbox',
  '--disable-gpu',
  'http://localhost:4200/login'
]);

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  const listRes = await fetch('http://localhost:9222/json');
  const tabs = await listRes.json();
  const pageTab = tabs.find(t => t.type === 'page' || t.url.includes('localhost:4200')) || tabs[0];

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  ws.onopen = async () => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.log('[BROWSER EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      }
    };

    await send('Runtime.enable');
    await send('Page.enable');

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('solar_auth_user', JSON.stringify({
          id: 1, name: 'Admin Dinesh', username: 'admin', role: 'admin', designation: 'Admin'
        }));
        location.href = '/awarded-sites';
      `
    });

    console.log('Waiting 5s for table to load...');
    await new Promise(r => setTimeout(r, 5000));

    const checkTable = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rows = Array.from(document.querySelectorAll('table tbody tr'));
          const links = Array.from(document.querySelectorAll('table tbody tr a'));
          return {
            url: location.href,
            rowCount: rows.length,
            links: links.map(l => ({ text: l.textContent.trim(), title: l.title, href: l.href }))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Table state:', JSON.stringify(checkTable.result?.value, null, 2));

    ws.close();
    edge.kill();
    process.exit(0);
  };
}

run().catch(e => {
  console.error(e);
  edge.kill();
  process.exit(1);
});
