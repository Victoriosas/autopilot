import React from 'react';
import { articles, categories, getPublishedArticles, type EditorialArticle } from '../../storefront/editorial';
import { ContactLink } from './ContactLink';

const review = __EDITORIAL_REVIEW__;
const visible = review ? articles : getPublishedArticles();
const base = '/de-mi-para-ti';
const description = 'Un espacio pensado como una pausa. Bienestar, belleza y pequeños rituales para el cuidado cotidiano.';
function Card({article}: {article: EditorialArticle}) {
  return <article className="editorial-card"><a href={`${base}/${article.slug}`}><img src={article.image} alt={article.imageAlt} width="800" height="500" loading="lazy" /><p className="beauty-eyebrow">{article.category}</p><h2>{article.title}</h2></a><p className="beauty-small">{article.status === 'draft' ? 'Borrador para revisión · Sin publicar' : <time dateTime={article.date!}>{article.date}</time>}</p><p>{article.paragraphs[0]}</p><a href={`${base}/${article.slug}`}>Leer artículo →</a></article>;
}
export function EditorialTeaser() {
 return <section className="beauty-section editorial-teaser"><p className="beauty-eyebrow">Un espacio en confianza.</p><h2>De mí para ti</h2><p>{description}</p><a className="beauty-button" href={base}>Entrar al espacio</a></section>;
}
export function EditorialPage() {
 const path=window.location.pathname.replace(/\/$/,'');
 const slug=path===base?'':path.slice(base.length+1);
 const category=new URLSearchParams(window.location.search).get('categoria');
 const article=visible.find(item=>item.slug===slug);
 React.useEffect(()=>{
  document.title=article?`${article.title} · De mí para ti · Victoriosas`:'De mí para ti · Victoriosas';
  const canonical=document.querySelector('link[rel="canonical"]');canonical?.setAttribute('href','https://victoriosas.online'+(article?`${base}/${article.slug}`:base));
  document.querySelector('meta[name="description"]')?.setAttribute('content',article?.paragraphs[0]||description);
  if(review||slug&&!article)document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow');
 },[article,slug]);
 if(slug&&!article)return <section className="beauty-section"><h1>Esta lectura no está disponible.</h1><a href={base}>Volver a De mí para ti</a></section>;
 if(article)return <article className="editorial-reading"><a href={base}>← De mí para ti</a><p className="beauty-eyebrow">{article.category}</p><h1>{article.title}</h1><button type="button" className="editorial-print-action" onClick={() => window.print()}>Imprimir o guardar esta lectura</button><p className="beauty-small">{article.status==='draft'?'Borrador para revisión · Fecha pendiente de aprobación':<time dateTime={article.date!}>{article.date}</time>}</p><img className="editorial-cover" src={article.image} alt={article.imageAlt} width="800" height="500" />{article.paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}{article.sources.length>0&&<aside><h2>Fuentes</h2><ul>{article.sources.map(source=><li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a></li>)}</ul></aside>}<section className="beauty-section"><h2>Para seguir compartiendo</h2>{article.relatedSlugs.map(related=>visible.find(item=>item.slug===related)).filter((item):item is EditorialArticle=>Boolean(item)).map(item=><p key={item.slug}><a href={`${base}/${item.slug}`}>{item.title} →</a></p>)}</section><aside className="beauty-about"><p>Si querés conversar sobre tu cuidado, podés solicitar una evaluación inicial remota. Es orientativa y no sustituye la valoración médica cuando corresponde.</p><ContactLink>Consultar con calma</ContactLink></aside></article>;
 const filtered=category?visible.filter(item=>item.category===category):visible;
 return <><section className="beauty-section editorial-heading"><p className="beauty-eyebrow">Un espacio en confianza.</p><h1>De mí para ti</h1><p>{description}</p>{review&&<p className="editorial-review" role="note">Vista de revisión: los artículos son borradores sin publicar. Ningún contenido está programado.</p>}</section><nav className="editorial-categories" aria-label="Categorías editoriales"><a href={base} aria-current={!category?'page':undefined}>Todas</a>{categories.map(item=><a key={item} href={`${base}?categoria=${encodeURIComponent(item)}`} aria-current={category===item?'page':undefined}>{item}</a>)}</nav><section className="editorial-grid" aria-label="Artículos">{filtered.map(item=><div key={item.slug}><Card article={item}/></div>)}{!filtered.length&&<div><h2>{category?'Más lecturas, pronto':'Un espacio para encontrarnos'}</h2><p>Estamos preparando nuevas lecturas para compartir. Mientras tanto, podés conocer cómo comienza la atención.</p><a href="/#servicios">Conocer el primer paso →</a></div>}</section></>;
}
