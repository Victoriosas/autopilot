import test from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { salesAction, hasExternalChannel } from './salesChannel';
import { cartLimit, restoreCart } from './cartState';
import { discoverProducts } from './catalogDiscovery';

const product = (offer?: unknown, overrides = {}) => ({
 id:'p1',status:'published',title:'Vincha de spa',category:'Accesorios',description:'',tags:[],sku:'V1',
 price:100,inventory:4,traceability:offer === undefined ? {} : {offer},...overrides
} as Product);
const affiliate = {mode:'affiliate',url:'https://tiendamia.com.uy/producto?ref=real',merchant:'Tiendamia',approved:true};
const options = {category:'Todos',query:'',maximumPrice:1000,routine:'all' as const,inStockOnly:false,sort:'featured' as const};

test('explicit external offers never enter cart, including stale restored carts and malformed metadata', () => {
 for (const offer of [affiliate,{mode:'inquiry',url:'https://wa.me/59899123456',merchant:'Victoriosa',approved:true},{mode:'unexpected'},null]) {
  const p=product(offer); assert.equal(hasExternalChannel(p),true); assert.equal(cartLimit(p),0);
  assert.deepEqual(restoreCart([{productId:p.id,quantity:1}],[p]),[]);
 }
 assert.equal(cartLimit(product()),4);
});

test('affiliate action requires reviewed HTTPS destination and explains who sells and possible commission', () => {
 const action=salesAction(product(affiliate));
 assert.equal(action.kind,'affiliate'); assert.equal(action.href,affiliate.url);
 assert.match(action.disclosure,/comisión/); assert.match(action.disclosure,/Tiendamia/);
 for(const url of ['javascript:alert(1)','http://tiendamia.com.uy','https://a:b@tiendamia.com.uy','https://localhost/x','https://127.0.0.1','https://192.168.1.1','https://example.com:8443','https://[::1]/']) {
  assert.equal(salesAction(product({...affiliate,url})).kind,'blocked',url);
 }
 for(const changes of [{approved:false},{approved:'true'},{merchant:''},{mode:'bad'}]) {
  assert.equal(salesAction(product({...affiliate,...changes})).kind,'blocked');
 }
 assert.equal(salesAction(product(null)).kind,'blocked');
});

test('inquiry only opens a configured WhatsApp destination and never transmits customer identity', () => {
 const p=product({mode:'inquiry',url:'https://wa.me/59899123456',merchant:'Victoriosa',approved:true});
 const a=salesAction(p); assert.equal(a.kind,'inquiry');
 assert.match(new URL(a.href!).searchParams.get('text')!,/Vincha de spa/);
 assert.match(a.disclosure,/confirmar/);
 for (const url of ['https://evil.test/59899123456','https://wa.me/short','https://wa.me/59899123456?text=private']) {
  assert.equal(salesAction(product({...p.traceability.offer,url})).kind,'blocked');
 }
});

test('catalog includes reviewed external products without invented prices or inventory and hides invalid offers', () => {
 const p=product(affiliate,{price:0,inventory:0});
 assert.deepEqual(discoverProducts([p,product({...affiliate,approved:false})],options),[p]);
 assert.deepEqual(discoverProducts([p],{...options,inStockOnly:true}),[]);
 assert.deepEqual(discoverProducts([product(affiliate,{status:'discovered'})],options),[]);
});
