import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:'**/*.spec.mjs',timeout:60000,workers:1,
  expect:{timeout:12000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:4193/art-hackathon/metaverse/',viewport:{width:1440,height:900},headless:true,
    launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']},
    permissions:['camera'],trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node ../server.mjs',env:{PORT:'4193'},url:'http://127.0.0.1:4193/',reuseExistingServer:false,timeout:15000},
});
