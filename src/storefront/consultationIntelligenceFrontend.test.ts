import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsultationIntelligencePanel } from '../components/admin/ConsultationIntelligencePanel';
test('shadow panel distinguishes validation from delivery and is disabled by default',()=>{
 const html=renderToStaticMarkup(React.createElement(ConsultationIntelligencePanel,{requestId:'88888888-8888-4888-8888-888888888888',enabled:false}));
 assert.match(html,/Modo sombra/);assert.match(html,/no envía/);assert.match(html,/disabled/);assert.doesNotMatch(html,/Aprobar y enviar/);
});
