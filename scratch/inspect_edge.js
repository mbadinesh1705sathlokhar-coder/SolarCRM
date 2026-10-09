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
  console.log('Target tab:', pageTab.url);

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
    console.log('Connected to CDP');
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

    console.log('Setting localStorage auth user and navigating to /awarded-sites...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('solar_auth_user', JSON.stringify({
          id: 1,
          name: 'Admin Dinesh',
          username: 'admin',
          role: 'admin',
          designation: 'Admin'
        }));
        location.href = '/awarded-sites';
      `
    });

    console.log('Waiting 4s for /awarded-sites to load...');
    await new Promise(r => setTimeout(r, 4000));

    // Try finding SP425 and clicking it
    const clickResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll('a, button, span, tr'));
          const sp425Link = Array.from(document.querySelectorAll('a')).find(el => el.textContent && el.textContent.includes('SP425'));
          if (!sp425Link) {
            return 'SP425 not found. All links count: ' + document.querySelectorAll('a').length + ', URL: ' + location.href;
          }
          sp425Link.click();
          return 'Found and clicked SP425 link: ' + sp425Link.outerHTML;
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickResult.result?.value);

    console.log('Waiting 2s after click...');
    await new Promise(r => setTimeout(r, 2000));

    // Check modal state
    const modalCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector('.modal.show, [class*="modal"]');
          if (!modal) return 'No modal found';
          const inputs = Array.from(modal.querySelectorAll('input, select, textarea, button'));
          const siteIdInput = modal.querySelector('input[name="siteId"]');
          const closeBtn = modal.querySelector('.btn-close');
          const cancelBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Cancel'));
          
          return {
            modalTag: modal.tagName,
            modalClass: modal.className,
            modalStyle: modal.getAttribute('style'),
            computedZIndex: window.getComputedStyle(modal).zIndex,
            computedDisplay: window.getComputedStyle(modal).display,
            siteIdValue: siteIdInput ? siteIdInput.value : null,
            siteIdDisabled: siteIdInput ? siteIdInput.disabled : null,
            siteIdReadonly: siteIdInput ? siteIdInput.readOnly : null,
            totalControls: inputs.length,
            closeBtnExists: !!closeBtn,
            cancelBtnExists: !!cancelBtn
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal check:', modalCheck.result?.value);

    // Test trying to type into siteId
    const testType = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const siteIdInput = document.querySelector('input[name="siteId"]');
          if (!siteIdInput) return 'Site ID input not found';
          siteIdInput.focus();
          siteIdInput.value = 'SP425_EDITED';
          siteIdInput.dispatchEvent(new Event('input', { bubbles: true }));
          return {
            focused: document.activeElement === siteIdInput,
            newValue: siteIdInput.value
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Typing test:', testType.result?.value);

    // Test clicking Cancel
    const testCancel = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cancelBtn = Array.from(document.querySelectorAll('.modal button')).find(b => b.textContent && b.textContent.includes('Cancel'));
          if (!cancelBtn) return 'Cancel button not found';
          cancelBtn.click();
          return 'Clicked Cancel button';
        })()
      `,
      returnByValue: true
    });
    console.log('Cancel click result:', testCancel.result?.value);

    await new Promise(r => setTimeout(r, 1000));

    const checkModalAfterCancel = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector('.modal.show, [class*="modal"]');
          return { modalStillVisible: !!modal };
        })()
      `,
      returnByValue: true
    });
    console.log('After cancel:', checkModalAfterCancel.result?.value);

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
