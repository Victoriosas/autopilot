import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SalesChannelAction} from '../components/store/SalesChannelAction';
import type {Product} from '../types';

test('external call to action discloses affiliate destination and never renders a checkout button',()=>{
 const html=renderToStaticMarkup(React.createElement(SalesChannelAction,{product:{title:'Vincha',traceability:{offer:{mode:'affiliate',url:'https://tiendamia.com.uy/item?ref=x',merchant:'Tiendamia',approved:true}}} as Product}));
 assert.match(html,/sponsored noopener noreferrer/); assert.match(html,/comisión/);
 assert.match(html,/href="https:\/\/tiendamia.com.uy\/item\?ref=x"/);
 assert.doesNotMatch(html,/Añadir|checkout|<button/);
});
test('unreviewed external action has no navigable link',()=>{
 const html=renderToStaticMarkup(React.createElement(SalesChannelAction,{product:{traceability:{offer:{mode:'affiliate',url:'https://tiendamia.com.uy',merchant:'Tiendamia',approved:false}}} as Product}));
 assert.doesNotMatch(html,/<a /);assert.match(html,/revisión/);
});
