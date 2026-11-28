from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path('/mnt/data/trade-risk-v1.4')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[]; alerts=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:(alerts.append(d.message),d.accept()))
 html=re.sub(r'<script src="[^"]+"></script>','', (root/'index.html').read_text())
 page.set_content(html)
 page.evaluate('''() => {const memory={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k]}});}''')
 scripts=['risk.js','app.js','portfolio-core.js','lot-core.js','portfolio.js','import-core.js','sbi-parser.js','sbi-roi.js','sbi-image-ocr.js','import.js','dashboard-core.js','readiness-core.js','dashboard.js','backup-core.js','backup.js']
 for s in scripts:page.add_script_tag(content=(root/s).read_text())
 page.locator('[data-tab="portfolio"]').click()
 page.locator('#accountForm [name="name"]').fill('架空の口座')
 page.locator('#accountForm [name="equity"]').fill('10000000')
 page.locator('#accountForm button').click()
 def add_lot(lot,qty):
  form=page.locator('#positionForm')
  form.locator('[name="name"]').fill('フジクラ [5803]')
  form.locator('[name="kind"]').select_option('long')
  form.locator('[name="theme"]').fill('AI')
  form.locator('[name="lotKey"]').fill(lot)
  form.locator('[name="entry"]').fill('5000')
  form.locator('[name="current"]').fill('5200')
  form.locator('[name="qty"]').fill(str(qty))
  form.locator('[name="stop"]').fill('4800')
  form.locator('button').click()
 add_lot('2026-11-23-A',400)
 add_lot('2026-11-24-B',600)
 assert page.locator('#positionsList .result').count()==2
 snap=page.evaluate('window.TradeRiskPortfolio.snapshot()')
 acct=snap['accounts'][0]['id']
 assert sum(x['qty'] for x in snap['positions'])==1000
 # An aggregate OCR candidate must not replace either detailed lot
 page.evaluate('''account=>document.dispatchEvent(new CustomEvent('trade-risk-import',{detail:{positions:[{account,code:'5803',kind:'long',entry:5300,current:5400,qty:1000,name:'フジクラ',theme:'AI'}]}}))''',acct)
 assert '保留1件' in alerts[-1],alerts[-1]
 snap=page.evaluate('window.TradeRiskPortfolio.snapshot()')
 assert sorted(x['qty'] for x in snap['positions'])==[400,600]
 # Explicit lot matches and preserves prior stop
 page.evaluate('''account=>document.dispatchEvent(new CustomEvent('trade-risk-import',{detail:{positions:[{account,code:'5803',kind:'long',entry:5000,current:5300,qty:400,lotKey:'2026-11-23-A',name:'フジクラ',theme:'AI'}]}}))''',acct)
 snap=page.evaluate('window.TradeRiskPortfolio.snapshot()')
 assert len(snap['positions'])==2
 assert any(x['qty']==400 and x['stop']==4800 and x['current']==5300 for x in snap['positions'])
 page.locator('[data-tab="dashboard"]').click()
 txt=page.locator('#dashboard').inner_text()
 assert '5,240,000円' in txt,txt[:1000]
 assert not errors,errors
 print('PASS browser: two lots, no aggregate overwrite, exact lot update, stop preserved, dashboard aggregated, no JS errors')
 browser.close()
