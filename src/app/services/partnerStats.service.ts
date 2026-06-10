import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';


@Injectable({
providedIn:'root'
})
export class PartnerStatsService{


pb = new PocketBase(
 'https://db.ongomatch.com:8090'
);



async getStats(partnerId:string){

 return await this.pb.collection('partner_stats')
 .getFirstListItem(
   `partnerId="${partnerId}"`,
   {
    requestKey:null
   }
 );

}



async registerLocalVisit(partnerId:string){


try{


const stats:any =
await this.getStats(partnerId);



const hour =
new Date()
.getHours()
.toString();



const traffic =
stats.hourlyTraffic || {};



traffic[hour] =
Number(traffic[hour] || 0)+1;



const peakHour =
Object.entries(traffic)
.sort(
(a:any,b:any)=>b[1]-a[1]
)[0]?.[0];



await this.pb.collection('partner_stats')
.update(stats.id,{


currentVisitors:
Number(stats.currentVisitors || 0)+1,


todayVisitors:
Number(stats.todayVisitors || 0)+1,


totalVisits:
Number(stats.totalVisits || 0)+1,


hourlyTraffic:traffic,


peakHour:`${peakHour}:00`,


lastUpdated:new Date()


},{
requestKey:null
});



}catch{


await this.pb.collection('partner_stats')
.create({

partnerId,


currentVisitors:1,

todayVisitors:1,

totalVisits:1,


peakHour:
`${new Date().getHours()}:00`,


hourlyTraffic:{
 [new Date().getHours()]:1
 },


lastUpdated:new Date()


},{
requestKey:null
});


}



}



}