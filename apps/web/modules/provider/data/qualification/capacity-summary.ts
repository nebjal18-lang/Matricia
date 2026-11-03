/** A mixed service portfolio never inherits the first service's apparent availability. */
export function capacitySummaryStatus(services:readonly {capacityStatus:string}[]):string{
 const statuses=[...new Set(services.map(x=>x.capacityStatus))];return statuses.length===1?statuses[0]!:statuses.length?"MIXED":"NOT_DECLARED";
}
