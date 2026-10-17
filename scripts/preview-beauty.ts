// Loopback preview only; no dotenv, real credentials, writes or schedulers.
import express from 'express';
import path from 'node:path';
import { createBeautyRouter } from '../src/storefront/beautyRouter';
const app=express();
app.use('/api/beauty',createBeautyRouter({enabled:()=>false}));
app.get('/beauty',(_req,res)=>res.sendFile(path.resolve('public/servicios-sofia.html')));
app.use(express.static(path.resolve('public')));
app.listen(4178,'127.0.0.1',()=>console.log('Beauty safe preview: http://127.0.0.1:4178/beauty (requests disabled)'));
