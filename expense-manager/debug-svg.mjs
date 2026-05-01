import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await page.evaluate(() => {
    const txns = [];
    for (let m = 1; m <= 4; m++) {
      txns.push({ id: `inc-${m}`, type: 'income', amount: 50000+m*10000, categoryId: 'salary', accountId: '', note: '', date: `2026-${String(m).padStart(2,'0')}-15` });
      txns.push({ id: `exp-${m}`, type: 'expense', amount: 20000+m*5000, categoryId: 'food', accountId: '', note: '', date: `2026-${String(m).padStart(2,'0')}-10` });
    }
    localStorage.setItem('em_transactions', JSON.stringify(txns));
    localStorage.setItem('em_categories', JSON.stringify([
      { id: 'salary', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#22c55e', isCustom: false },
      { id: 'food', name: 'Food', type: 'expense', icon: 'UtensilsCrossed', color: '#ef4444', isCustom: false },
    ]));
    localStorage.setItem('em_accounts', JSON.stringify([]));
    localStorage.setItem('em_budgets', JSON.stringify([]));
    localStorage.setItem('em_settings', JSON.stringify({ currency: 'INR', dateFormat: 'DD/MM/YYYY' }));
  });
  
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  const result = await page.evaluate(() => {
    const barPaths = document.querySelectorAll('.recharts-rectangle');
    return Array.from(barPaths).slice(0, 5).map(p => {
      const computed = getComputedStyle(p);
      return {
        attrFill: p.getAttribute('fill'),
        computedFill: computed.fill,
        computedColor: computed.color,
        tagName: p.tagName,
      };
    });
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
})();
