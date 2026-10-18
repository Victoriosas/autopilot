async (page) => {
 const origin=new URL(page.url()).origin;
 await page.goto(origin+'/de-mi-para-ti');
 await page.getByRole('heading',{name:'De mí para ti',exact:true}).waitFor();
 if(await page.locator('.editorial-card').count())throw Error('Production build exposes draft cards');
 if(await page.locator('.editorial-review').count())throw Error('Production review flag enabled');
 for(const slug of ['una-pausa-tranquila-para-vos','ordenar-tu-rutina-cosmetica']){
  await page.goto(origin+'/de-mi-para-ti/'+slug);
  await page.getByRole('heading',{name:'Esta lectura no está disponible.',exact:true}).waitFor();
  if(await page.locator('.editorial-reading').count())throw Error('Draft content available '+slug);
 }

 return {productionBuildDraftsHidden:true,knownDraftUrlsUnavailable:2};
}
