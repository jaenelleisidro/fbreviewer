// ==UserScript==
// @name         Facebook Reviewer
// @namespace    https://www.facebook.com/
// @namespace    https://m.facebook.com/
// @version      0.3
// @description  try to take over the world!
// @author       You
// @match        https://www.facebook.com/*
// @match        https://m.facebook.com/*
// @grant        none
// ==/UserScript==
(async function() {
    'use strict';
    console.log("im at fb");

    function sleepAsync(args){
        args=args||{timeout:1000};//timeout in seconds
        let promise = new Promise((resolve, reject) => {
            setTimeout(()=>{
                resolve(null);
            },args.timeout);
        });
        return promise;
    }

    function scrollToBottom(){window.scrollTo(0,document.body.scrollHeight);}

   function keepScrollingUntilEnd(args){
    args=args||{timeout:0};//timeout in seconds
      let promise = new Promise((resolve, reject) => {

          var keepScrolling=setInterval(function(){window.scrollTo(0,document.body.scrollHeight);},2000);
          var lastScrollHeight=0;
          var scrollEndDetect=setInterval(function(){

              if(document.body.scrollHeight!=lastScrollHeight){console.log("not finished scrolling");lastScrollHeight=document.body.scrollHeight;return;}
              clearInterval(keepScrolling);clearInterval(scrollEndDetect);
              console.log("it ended");
              resolve(null);
          },10000);

          if(args.timeout){
              setTimeout(()=>{
                  clearInterval(keepScrolling);clearInterval(scrollEndDetect);
                  console.log("timeout reached");
                  resolve(null);
              },args.timeout*1000);
          }
      });

    return promise;
   }

    function harvestLikes(args){
      args=args||{timeout:0};
      let promise = new Promise(async (resolve, reject) => {
          await keepScrollingUntilEnd(args);
          //document.querySelector('#timelineBody').querySelectorAll('a')[0].parentElement.textContent
          let likesHolder=document.querySelector('#timelineBody');
          if(likesHolder==null){reject("likesHolder can't be null");return;}
          let likes=likesHolder.querySelectorAll('a');
          let result=[];
          for(let i=0;i<likes.length;i++){
              let like=likes[i];
              result.push({href:like.getAttribute('href'),text:like.parentElement.textContent});
          }
          resolve(result);
      });
    return promise;

    }
    function harvestPosts(args){
      args=args||{timeout:5*60};
      let promise = new Promise(async (resolve, reject) => {
          await keepScrollingUntilEnd(args);
          //[0].innerText
          let postsHolder=document.querySelector('#structured_composer_async_container');
          if(postsHolder==null){reject("postsHolder can't be null");return;}
          let posts=postsHolder.querySelectorAll('article');
          let result=[];
          for(let i=0;i<posts.length;i++){
              let post=posts[i];
              result.push({text:post.textContent});
          }

          resolve(result);
      });
    return promise;
    }

    function summarizeMatches(keywords,items){
        let summary={};
        for(let i=0;i<keywords.length;i++){
            let keyword=keywords[i];
            for(let i2=0;i2<items.length;i2++){
                let item=items[i2];
                if(item.text.toLowerCase().contains(keyword)==false){continue;}
                summary[keyword]=summary[keyword]||[];
                summary[keyword].push(item);
            }
        }

        summary.otherData={keywords,items};
        return summary;
    }

    function textSummary(summary){
        let text="";
        for(let key in summary){
            if(key=='otherData'){continue;}
            text=text+" \n\n* "+key+" * \n\n";
            let summaryRows=summary[key];
            for(let i=0;i<summaryRows.length;i++){
                let summaryRow=summaryRows[i];
                text=text+summaryRow.text+"\n\n"
            }
        }
        text=text+"\n---------------------\n";
        return text;
    }

    async function sendMessage(text){
        await sleepAsync({timeout:3000});
        let sendMessageForm=document.querySelector('form[data-sigil="m-messaging-composer"]');
        let messageTextbox=sendMessageForm.querySelector('textarea');
        messageTextbox.value=text
        var e = new Event("keydown");
        e.keyCode = 13;
        messageTextbox.dispatchEvent(e);
        sendMessageForm.querySelector('[type=submit]').click()
    }


    async function waitUntilNotNull(data){
        let {callback,timeout=10000}=data;
        let item=null;
        let dateStarted=new Date();

        do{
            try{
            await sleepAsync();
            item=await callback();
            }catch(e){console.log(e);};
        }while(item==null && (new Date().getTime()-dateStarted.getTime())<timeout)
        return item;
    }

    function findDivThatContains(text){
        let xpath = "//div[text()='"+text+"']";
        let element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return element;
    }

    async function moveFromAboutUsToAllLikesPageAsync(){
        await keepScrollingUntilEnd();
        //click like section
        let e=await waitUntilNotNull({callback:()=>{return findDivThatContains('Likes').parentElement.parentElement.querySelector('a');}});
        if(e){e.click();}
        sleepAsync();
        //click all likes
        let e2=await waitUntilNotNull({callback:()=>{return findDivThatContains('All Likes').parentElement.parentElement.parentElement.parentElement.querySelector('a');}});
        if(e2){e2.click();}

    }

        async function harvestLink(openUrl){
            let pathname=generatePathNameFromFacebookProfileUrl(openUrl);
            let pathnameStatusKey=generateStatusKey(pathname);
            let pathnameKey=generateKey(pathname);
            localStorage.setItem(pathnameStatusKey,"pending");
            let fbProfileUrlWindow=window.open(openUrl);
            let status=null;let summary=null;
            while(status!="completed"){
                await sleepAsync();
                console.log("waiting for "+pathnameStatusKey);
                status=getJsonStatus(pathnameStatusKey);
            }
            summary=getJsonSummary(pathnameKey);
            console.log(summary);
            fbProfileUrlWindow.close();
            return summary;
        }

    function createAElement(text,href){
      var a = document.createElement('a');
      var linkText = document.createTextNode(text);
      a.appendChild(linkText);
      a.title = text;
      a.href = href;
        return a;
    }
    function extractUrls(links){
            let urls=[];
            for(let i=0;i<links.length;i++){
                let href=links[i].getAttribute('href');
                urls.push(href);
            }
            return urls;
        }

    function extractUrlsFromText(text){
        var expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
        var matches = text.match(expression);
        if(matches){return matches;}
        return [];
    }

    let facebookUrl="https://m.facebook.com/";
    function generatePathNameFromFacebookProfileUrl(fbProfileUrl){return fbProfileUrl.substr(facebookUrl.length-1,fbProfileUrl.length);}
    function generateStatusKey(pathname){return 'fb_reviewer_status_'+pathname;}
    function generateKey(pathname){return 'fb_reviewer_'+pathname;}

    let pathname=generatePathNameFromFacebookProfileUrl(document.location.href);
    let storageKey=generateKey(pathname);
    let storageKeyStatus=generateStatusKey(pathname);
    console.log("storageKeyStatus:"+storageKeyStatus)
    function saveJsonStatus(status){localStorage.setItem(storageKeyStatus,status);}
    function getJsonStatus(storageKeyStatus){return localStorage.getItem(storageKeyStatus);}
    function saveJsonSummary(json){localStorage.setItem(storageKey,JSON.stringify(json));}
    function getJsonSummary(storageKey){return JSON.parse(localStorage.getItem(storageKey));}

    let keywords=["worthless","alienated","bully","depress","depression","abuse","abusive","trauma","ptsd","heal","recover","cruel","harass","emotional","narc","empath","suicide","suicidal","mental","cheat","betray","forgive","broken","bpd","borderline","personality disorder","domestic violence"]
    let summary={};
    saveJsonStatus("ongoing");
    if(/https:\/\/m.facebook.com\/\S*\/about/i.test(document.location.href) || /https:\/\/m.facebook.com\/profile.php?\S*&v=info/i.test(document.location.href)){
    //if('https://m.facebook.com/timeline/app_collection/?collection_token=100002156421847%3A2409997254%3A96'==document.location.href){
        //likes starting point is about us example https://m.facebook.com/michelle.l.reed430/about
        console.log('harvestLikes');
        saveJsonStatus("ongoing");

        await moveFromAboutUsToAllLikesPageAsync();

        let result=[]
        try{
            result=await harvestLikes();
        }catch(e){}
       summary=summarizeMatches(keywords,result);

    }else if(/https:\/\/m.facebook.com\/messages\/\S*/i.test(document.location.href)){
        console.log('message');
        sleepAsync({timeout:10000});
        await sendMessage("fb profile reviewer bot started, awaiting for profile links");
        //document.querySelector('#messageGroup').querySelectorAll('[data-sigil="message-xhp marea"]')[4].querySelector('[data-sigil="message-text"]').querySelectorAll('a')[0]
        let messagesHolder=null;
        do{
            await sleepAsync(1000);
            if(messagesHolder==null){messagesHolder=document.querySelector('#messageGroup');}
        }while(messagesHolder==null);

        while(true){
        scrollToBottom();

        let messages=messagesHolder.querySelectorAll('[data-sigil="message-xhp marea"]');



        let fbProfileUrls=[];
        let i=messages.length-1;
        //for(let i=0;i<messages.length;i++){
            let message=messages[i];

            let links=message.querySelector('[data-sigil="message-text"]').querySelectorAll('a');
            //let links=message.querySelectorAll('a');
            let urls=extractUrls(links);

            if(urls.length==0){urls=extractUrlsFromText(message.querySelector('[data-sigil="message-text"]').textContent);}

            if(urls.length==0){
                let possibleLink=message.querySelector('[data-sigil="message-text"]').textContent;
                if(possibleLink.startsWith("https://www.facebook.com/")){console.log('its a single link');urls.push(possibleLink);}
            }

            for(let i2=0;i2<urls.length;i2++){
                let url=urls[i2];
                if(url.contains("?") && url.startsWith("https://www.facebook.com/profile.php")==false){url=url.split("?")[0];}
                if(url.startsWith('https://www.')){url="https://m."+url.substr("https://www.".length);}
                if(url.endsWith("/")){url=url.substr(0,url.length-1);}
                if(fbProfileUrls.includes(url)){continue;}
                if(url.startsWith('https://m.')==false){continue;}
                fbProfileUrls.push(url);
            }


            if(fbProfileUrls.length==0){console.log("no profile to review");await sleepAsync();continue;}
        await sendMessage("you gave me "+fbProfileUrls.length+" fb profiles to review");



        let summaries=window.summaries=[];
        let progress=0;
        let maxThreads=1;
        await sendMessage("max thread:"+maxThreads);
        function convertProgressToPercent(progress,max){return (progress*100/max).toFixed(2)+"%";}
        for(let i=0;i<fbProfileUrls.length;i++){
            setTimeout(async ()=>{
                let fbProfileUrl=fbProfileUrls[i];
                let userName=fbProfileUrl.substr("https://m.facebook.com/".length);
                await sendMessage("harvesting posts of "+userName);
                let postSummary=await harvestLink(fbProfileUrl);
                progress=progress+1;
                await sendMessage("done harvesting posts of "+userName+" >>>"+convertProgressToPercent(progress,fbProfileUrls.length*2));
                await sendMessage("harvesting likes of "+userName);
                let aboutUsUrl=fbProfileUrl+"/about";
                if(fbProfileUrl.startsWith("https://m.facebook.com/profile.php")){aboutUsUrl=fbProfileUrl+"&v=info";}
                let likeSummary=await harvestLink(aboutUsUrl);
                progress=progress+1;
                await sendMessage("done harvesting likes of "+userName+" >>>"+convertProgressToPercent(progress,fbProfileUrls.length*2));
                summaries.push({fbProfileUrl,postSummary,likeSummary});
            },1);
            while((i+1)-summaries.length>=maxThreads){
                console.log("sleeping.. ("+i+"/"+summaries.length+"/"+fbProfileUrls.length+")")
                await sleepAsync();
            }
        }
        while(summaries.length<fbProfileUrls.length){
            console.log("sleeping.. ("+summaries.length+"/"+fbProfileUrls.length+")")
            await sleepAsync();
        }
        let summariesText="";
        for(let i=0;i<summaries.length;i++){
            let summary=summaries[i];
            let {fbProfileUrl,postSummary,likeSummary}=summary;
            let summaryText=fbProfileUrl+"\n";
            summaryText=summaryText+"*** POSTS ****\n\n";
            console.log("post summary");
            console.log(postSummary);
            summaryText=summaryText+"total posts reviewed : "+postSummary.otherData.items.length+"\n";
            summaryText=summaryText+textSummary(postSummary);
            summaryText=summaryText+"*** LIKES ****\n\n";
            console.log("like summary");
            console.log(likeSummary);
            summaryText=summaryText+"total likes reviewed : "+likeSummary.otherData.items.length+"\n";
            summaryText=summaryText+textSummary(likeSummary);
            summaryText=summaryText+"\n##########################################\n\n";
            await sendMessage(summaryText);
            summariesText=summariesText+summaryText
        }
        await sendMessage("done processing links");
        window.summariesText=summariesText;
        console.log(summariesText);
        sleepAsync({timeout:3000});
        if(summaries.length>0){document.location.reload();}
        
        }


    //}else if(/https:\/\/www.facebook.com\/[A-Za-z0-9_.]*/i.test(document.location.href)){
    //}else if(/https:\/\/www.facebook.com\/[0-9A-Za-z](\w| )*/i.test(document.location.href)){
    }else if(/https:\/\/m.facebook.com\/\S*/i.test(document.location.href)){

        //check if at profile page example https://www.facebook.com/michelle.l.reed430
        console.log('harvestPosts');
        let result=[]
        try{
            result=await harvestPosts({timeout:15*60});
        }catch(e){}

        summary=summarizeMatches(keywords,result);
        console.log(summary);
    }else{//probably master tab
        console.log('master tab ready');
        
    }
    setInterval(()=>{
        window.summary=summary;
        console.log('saving');
        saveJsonSummary(summary);
        saveJsonStatus("completed");
    },100);
    console.log(summary);
    console.log(storageKey);


})();
