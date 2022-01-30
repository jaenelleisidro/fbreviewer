// ==UserScript==
// @name         Facebook Profile Link Harvester
// @namespace    https://www.facebook.com/
// @version      0.1
// @description  try to take over the world!
// @author       Jaenelle Isidro
// @match        https://www.facebook.com/*
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

    async function sleepUntilQuerySelectorAllHasResult({timeout=60000,query}){
        let items=[];
        let elapsedTime=0;
        do{
            console.log("sleeping since no items ready yet : elapsedTime:"+elapsedTime+ " query:"+query);
            await sleepAsync();
            elapsedTime=elapsedTime+1000;
            if(elapsedTime>=timeout){throw Error("timeout reached for sleepUntilQuerySelectorAllHasResult");}
            items=document.querySelectorAll(query);
            console.log(items);
        }while(items.length==0)
            console.log("found");
            console.log(items);
        return items;
    }

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



    function parseDocumentLocationSearch(){
        return parseSearch(document.location.search);
    }
    function parseSearch(hashMapSeperatedByAndAndEqual){
        let container = {};
        hashMapSeperatedByAndAndEqual.split('&').toString().substr(1).split(",").forEach(item => {
            container[item.split("=")[0]] = decodeURIComponent(item.split("=")[1]) ? item.split("=")[1]: "No query strings available" ;
        });
        return container;
    }

 /**
 * Adds query params to existing URLs (inc merging duplicates)
 * @param {string} url - src URL to modify
 * @param {object} params - key/value object of params to add
 * @returns {string} modified URL
 */
function addQueryParamsToUrl(url, params) {

    // if URL is relative, we'll need to add a fake base
    var fakeBase = !url.startsWith('http') ? 'http://fake-base.com' : undefined;
    var modifiedUrl = new URL(url || '', fakeBase);

    // add/update params
    Object.keys(params).forEach(function(key) {
        if (modifiedUrl.searchParams.has(key)) {
            modifiedUrl.searchParams.set(key, params[key]);
        }
        else {
            modifiedUrl.searchParams.append(key, params[key]);
        }
    });

    // return as string (remove fake base if present)
    return modifiedUrl.toString().replace(fakeBase, '');
}

function removeSearchParameter(url){
    let urlObj = new URL(url);
    return urlObj.origin+urlObj.pathname+"";
}



    function harvestInitialProfileLinks(args){
      args=args||{timeout:5*60};
      let promise = new Promise(async (resolve, reject) => {
          await keepScrollingUntilEnd(args);
          let initialProfileLinks=[];
          let links=document.querySelectorAll('a[href*="/groups"]');
          let alreadyInserted=[];
          for(let i=0;i<links.length;i++){
              let link=links[i];
              let possibleProfileLink=removeSearchParameter(link.href);
//              console.log(possibleProfileLink);
              if(/https:\/\/www.facebook.com\/groups\/\S*\/user\/\S*/i.test(possibleProfileLink)){
                  let name=link.ariaLabel||link.innerText;
                  if(alreadyInserted.includes(possibleProfileLink)){console.log("link already exists:"+possibleProfileLink);continue;}
                  initialProfileLinks.push({name,possibleProfileLink});
                  alreadyInserted.push(possibleProfileLink);
              }
          }


          resolve({initialProfileLinks,alreadyInserted});
      });
    return promise;
    }


    function harvestProfileLinks(args){
      args=args||{timeout:5*60};
      let promise = new Promise(async (resolve, reject) => {
          let {initialProfileLinks,alreadyInserted}=await harvestInitialProfileLinks(args);
          let profileLinks=[];
          for(let i=0;i<initialProfileLinks.length;i++){
              let initialProfileLink=initialProfileLinks[i];
              let profileLink=await simpleStorage.awaitAndPopValue({url:initialProfileLink.possibleProfileLink,key:"profile_link"});
              profileLinks.push({...initialProfileLink,profileLink});
          }


          resolve({initialProfileLinks,alreadyInserted,profileLinks});
      });
    return promise;
    }

    class SimpleStorage{
        constructor(storageKey){this.storageKey=storageKey;}
        openNewWindow(url){return window.open(url,'_blank');}
        setValue(key,value){localStorage.setItem(this.storageKey+"_"+key,value);}
        getValue(key,defaultValue){return localStorage.getItem(this.storageKey+"_"+key)||null;}
        deleteValue(key){this.setValue(key,"");}
        popValue(key){let value=this.getValue(key);this.deleteValue(key);return value;}
        setValuePersistent(key,value){
            return setInterval(()=>{
                this.setValue(key,value);
                console.log("persistent set key:"+key+" value:"+value);
            },1000);
        }
        async deleteValuePersistent(key){
            let value=null;
            do{
                this.deleteValue(key);
                await sleepAsync({timeout:2000});
                value=this.getValue(key,null)
            }while(value);
        }

        async awaitAndPopValue({url,key,timeout=60000}){
            console.log("starting awaitAndPopValue: url="+url);
            console.log(url);
            console.log("deleting key:"+key);
            await this.deleteValuePersistent(key);
            console.log("deleted key:"+key);
            let window=this.openNewWindow(url);
            let value=null;
            do{
                await sleepAsync();
                value=this.getValue(key,null);
                console.log(value);
            }while(value==null);
            window.close();await sleepAsync();
            await this.deleteValuePersistent(key);
            console.log("ending awaitAndPopValue: value="+value);
            return value;
        }

    }
    let storageKey='fb_profile_link_harvester';
    let simpleStorage=new SimpleStorage(storageKey);

console.log("https://www.facebook.com/groups/1676405812594662/member-requests");

    let summary={};

    let documentLocationHref=document.location.href;

    if(/https:\/\/www.facebook.com\/groups\/\S*\/member-requests/i.test(documentLocationHref)){
        let searchMap=parseDocumentLocationSearch();
        if(searchMap.membership_questions!="answered_all_questions"){
            document.location.href=addQueryParamsToUrl(documentLocationHref,parseSearch('joined_fb_recently=false&membership_questions=answered_all_questions&previously_removed_members=false&saved_filter=&suggested=false'));
        }
        console.log('master tab ready');

        let profileLinks=await harvestProfileLinks()

        summary.profileLinks=profileLinks;
        let text="";
        for(let i=0;i<profileLinks.profileLinks.length;i++){
            let {name,profileLink}=profileLinks.profileLinks[i];
            text=text+"name:"+name+" profile:"+profileLink+"\n";
        }
        console.log(profileLinks);
        console.log(text);
    }else if(/https:\/\/www.facebook.com\/groups\/\S*\/user\/\S*\//i.test(documentLocationHref)){
        let options=await sleepUntilQuerySelectorAllHasResult({timeout:60*1000,query:'[aria-label="See Options"]'});
        options[0].click()
        let links=await sleepUntilQuerySelectorAllHasResult({timeout:60*1000,query:'a[href*="/profile.php"]'});
        console.log( links[0].href);
        simpleStorage.setValuePersistent("profile_link",links[0].href);
    }



//    let storageKey='fb_profile_link_harvester_'+document.location.pathname;





    //wait then delete it

//ined_fb_recently=false&membership_questions=answered_all_questions&previously_removed_members=false&saved_filter=&suggested=false
})();