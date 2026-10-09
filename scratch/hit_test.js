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

    // Wait until SP425 link exists in the table
    console.log('Waiting for table rows to load...');
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: `!!Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim() === 'SP425')`,
        returnByValue: true
      });
      if (res.result?.value) {
        console.log(`Found SP425 after ${(i + 1) * 0.5} seconds!`);
        break;
      }
    }

    // Click SP425
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const link = Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim() === 'SP425');
          if (!link) return 'Not found';
          link.click();
          return 'Clicked SP425';
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result?.value);

    // Wait for modal to render
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      const modalRes = await send('Runtime.evaluate', {
        expression: `!!document.querySelector('input[name="siteId"]')`,
        returnByValue: true
      });
      if (modalRes.result?.value) {
        console.log(`Modal opened after ${(i + 1) * 0.5}s!`);
        break;
      }
    }

    // Hit test on the modal
    const hitTest = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const siteIdInput = document.querySelector('input[name="siteId"]');
          const closeBtn = document.querySelector('.modal .btn-close');
          const cancelBtn = Array.from(document.querySelectorAll('.modal button')).find(b => b.textContent && b.textContent.includes('Cancel'));
          const clientNameInput = document.querySelector('input[name="clientName"]');

          function getHitInfo(el, name) {
            if (!el) return { name, exists: false };
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const hitEl = document.elementFromPoint(cx, cy);
            return {
              name,
              exists: true,
              value: el.value,
              rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
              center: { cx, cy },
              hitSame: hitEl === el,
              hitElement: hitEl ? {
                tag: hitEl.tagName,
                className: hitEl.className,
                id: hitEl.id
              } : null
            };
          }

          return {
            siteId: getHitInfo(siteIdInput, 'siteIdInput'),
            clientName: getHitInfo(clientNameInput, 'clientNameInput'),
            closeBtn: getHitInfo(closeBtn, 'closeBtn'),
            cancelBtn: getHitInfo(cancelBtn, 'cancelBtn')
          };
        })()
      `,
      returnByValue: true
    });

    console.log('HIT TEST RESULTS:');
    console.log(JSON.stringify(hitTest.result?.value, null, 2));

    // Try REAL mouse clicks using CDP Input.dispatchMouseEvent at center of siteIdInput
    const siteIdInfo = hitTest.result?.value?.siteId;
    if (siteIdInfo && siteIdInfo.exists) {
      const { cx, cy } = siteIdInfo.center;
      console.log(`Sending mouse click at (${cx}, ${cy})...`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });

      await new Promise(r => setTimeout(r, 500));

      const activeAfterClick = await send('Runtime.evaluate', {
        expression: `
          (() => {
            return {
              activeTag: document.activeElement ? document.activeElement.tagName : null,
              activeName: document.activeElement ? document.activeElement.name : null,
              activeClass: document.activeElement ? document.activeElement.className : null
            };
          })()
        `,
        returnByValue: true
      });
      console.log('Active element after mouse click on Site ID:', activeAfterClick.result?.value);
    }

    // Try REAL mouse click on Cancel button
    const cancelInfo = hitTest.result?.value?.cancelBtn;
    if (cancelInfo && cancelInfo.exists) {
      const { cx, cy } = cancelInfo.center;
      console.log(`Sending mouse click on Cancel at (${cx}, ${cy})...`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });

      await new Promise(r => setTimeout(r, 500));

      const modalAfterCancel = await send('Runtime.evaluate', {
        expression: `!!document.querySelector('.modal.show, [class*="modal"]')`,
        returnByValue: true
      });
      console.log('Modal visible after clicking Cancel:', modalAfterCancel.result?.value);
    }

    // Try switching to BOM tab and check for any console errors or freezes!
    console.log('Re-opening modal and switching to BOM tab (tab 5)...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const link = Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim() === 'SP425');
          if (link) link.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1000));

    // Click tab 5: BOM
    const bomTabClick = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bomTabBtn = Array.from(document.querySelectorAll('.modal .nav-link')).find(b => b.textContent && b.textContent.includes('BOM'));
          if (!bomTabBtn) return 'BOM tab button not found';
          bomTabBtn.click();
          return 'Clicked BOM tab';
        })()
      `,
      returnByValue: true
    });
    console.log('BOM tab click result:', bomTabClick.result?.value);

    await new Promise(r => setTimeout(r, 2000));

    // Check BOM table rendered
    const bomTableCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bomTable = document.querySelector('.custom-table');
          const groupHeaders = Array.from(document.querySelectorAll('.bom-group-header-row'));
          const itemRows = Array.from(document.querySelectorAll('.bom-item-row'));
          const addDropdown = document.querySelector('#bomAddDropdownMenu');
          return {
            tableFound: !!bomTable,
            groupHeadersCount: groupHeaders.length,
            groupNames: groupHeaders.map(h => h.textContent.trim().replace(/\\s+/g, ' ').substring(0, 50)),
            itemRowsCount: itemRows.length,
            addDropdownFound: !!addDropdown
          };
        })()
      `,
      returnByValue: true
    });
    console.log('BOM table check:', JSON.stringify(bomTableCheck.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 1000));
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
