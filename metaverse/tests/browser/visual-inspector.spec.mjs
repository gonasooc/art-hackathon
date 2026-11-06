import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function denyCamera(page){
  await page.addInitScript(()=>{window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.__cameraRequests++;return Promise.reject(new DOMException('Denied','NotAllowedError'));};});
}
const states=page=>page.locator('#world').evaluate(canvas=>JSON.parse(canvas.dataset.objectState));

test('visual mode inspects every real carriage and restores dissolved objects without camera access',async({page})=>{
  test.setTimeout(240000);await denyCamera(page);const errors=[],vision=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/vision-worker|vision_wasm|face_landmarker/.test(request.url()))vision.push(request.url());});
  await page.goto('./?mode=inspect');
  await expect(page.locator('body')).toHaveAttribute('data-phase','visual');
  await expect(page.locator('#setup')).toBeHidden();await expect(page.locator('#gaze-particles')).toBeHidden();
  await expect(page.locator('#visual-dissolve')).toBeDisabled();
  await mkdir(new URL('../../.cache/verification/',import.meta.url),{recursive:true});
  for(const [id,count] of [['00',0],['01',2],['02',3],['03',2],['04',3],['05',3],['06',3],['07',1]]){
    await page.locator('#visual-room').selectOption(id);
    await expect(page.locator('body')).toHaveAttribute('data-carriage',id);
    expect((await states(page)).filter(target=>target.id.startsWith(`${id}-`))).toHaveLength(count);
    if(!count){await expect(page.locator('#visual-dissolve')).toBeDisabled();continue;}
    if(id==='05'||id==='07')await page.screenshot({path:new URL(`../../.cache/verification/visual-${id}.png`,import.meta.url).pathname});
    await page.locator('#visual-dissolve').click();
    await expect.poll(async()=>(await states(page)).filter(target=>target.id.startsWith(`${id}-`)).every(target=>target.gone),{timeout:20000}).toBe(true);
    // Visual inspection never advances to another carriage or ends the experience.
    await expect(page.locator('body')).toHaveAttribute('data-phase','visual');
    await expect(page.locator('body')).toHaveAttribute('data-carriage',id);
    await page.locator('#visual-restore').click();
    await expect.poll(async()=>(await states(page)).filter(target=>target.id.startsWith(`${id}-`)).every(target=>!target.gone&&target.progress===null)).toBe(true);
  }
  expect(await page.evaluate(()=>window.__cameraRequests)).toBe(0);expect(vision).toEqual([]);expect(errors).toEqual([]);
});

test('preview controls survive resize and normal eye entry still requires the camera',async({page})=>{
  test.setTimeout(90000);await denyCamera(page);await page.goto('./?mode=inspect&car=05');
  const canvas=page.locator('#world');await expect(page.locator('body')).toHaveAttribute('data-phase','visual');
  await expect(page.locator('body')).toHaveAttribute('data-carriage','05');
  const original=await canvas.getAttribute('data-visual-pose');
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  await expect(canvas).not.toHaveAttribute('data-visual-pose',original);
  await page.getByRole('button',{name:'관찰 위치',exact:true}).click();await expect(canvas).toHaveAttribute('data-visual-pose',original);
  await page.mouse.move(720,250);await page.mouse.down();await page.mouse.move(820,280,{steps:5});await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('data-visual-pose',original);
  await page.getByRole('button',{name:'관찰 위치',exact:true}).click();
  await page.keyboard.down('KeyE');await page.waitForTimeout(250);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('KeyE');
  const stopped=await canvas.getAttribute('data-visual-pose');await page.waitForTimeout(200);await expect(canvas).toHaveAttribute('data-visual-pose',stopped);
  await page.locator('#visual-exposure').focus();await page.keyboard.press('End');await expect(canvas).toHaveAttribute('data-visual-exposure','3');
  await page.getByRole('button',{name:'원래 밝기'}).click();await expect(canvas).toHaveAttribute('data-visual-exposure','1');
  await page.locator('#visual-animation').click();
  const scenery=await canvas.getAttribute('data-scenery-distance');await page.waitForTimeout(250);await expect(canvas).toHaveAttribute('data-scenery-distance',scenery);
  await page.keyboard.press('KeyH');await expect(page.locator('#visual-panel')).toBeHidden();
  await page.keyboard.press('KeyH');await expect(page.locator('#visual-panel')).toBeVisible();
  await page.setViewportSize({width:1000,height:700});await expect(page.locator('body')).toHaveAttribute('data-phase','visual');
  await expect(page.locator('#message')).toBeHidden();
  expect(await page.evaluate(()=>window.__cameraRequests)).toBe(0);
  await page.getByRole('button',{name:'테스트 종료'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','idle');
  await expect(page.locator('#visual-panel')).toBeHidden();
  await page.getByRole('button',{name:'시선으로 시작'}).click();await expect(page.locator('body')).toHaveAttribute('data-phase','error');
  await expect(page.locator('#message-copy')).toContainText('카메라 권한');expect(await page.evaluate(()=>window.__cameraRequests)).toBe(1);
});
