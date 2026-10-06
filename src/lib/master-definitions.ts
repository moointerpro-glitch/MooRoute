export type Field = { name: string; label: string; type?: "text"|"number"|"date"|"datetime-local"|"time"|"select"|"textarea"; required?: boolean; max?: number; options?: {value:string;label:string}[]; lookup?: string };
const code:Field={name:"code",label:"รหัส",required:true,max:64};
const name:Field={name:"name",label:"ชื่อ",required:true,max:191};
export const masterDefinitions:Record<string,{title:string;table:string;fields:Field[];search:string[];active:string}>= {
  vehicles:{title:"ข้อมูลรถ",table:"Vehicle",active:"active",search:["plateNormalized","province","brand"],fields:[
    {name:"plateNormalized",label:"ทะเบียนรถ",required:true,max:32},{name:"province",label:"จังหวัดทะเบียน",required:true,max:100},
    {name:"brand",label:"ยี่ห้อ",max:100},{name:"model",label:"รุ่น",max:100},{name:"color",label:"สี",max:64},
    {name:"typeId",label:"ประเภทรถ",type:"select",lookup:"vehicle-types",required:true},{name:"wheelCount",label:"จำนวนล้อ",type:"number",required:true},
    {name:"bodyDescription",label:"ลักษณะตัวถัง",max:191},{name:"storageConditionId",label:"สภาพการเก็บรักษา",type:"select",lookup:"storage-conditions",required:true},
    {name:"capacity",label:"ความจุ",type:"number"},{name:"capacityUnit",label:"หน่วยความจุ",type:"select",options:[{value:"KG",label:"กิโลกรัม"},{value:"BOX",label:"กล่อง"},{value:"M3",label:"ลูกบาศก์เมตร"}]},
    {name:"ownerName",label:"เจ้าของรถ",max:191},{name:"availableFrom",label:"พร้อมใช้งานตั้งแต่ (เวลาประเทศไทย)",type:"datetime-local"},{name:"availableTo",label:"พร้อมใช้งานถึง (เวลาประเทศไทย)",type:"datetime-local"}]},
  "vehicle-types":{title:"ประเภทรถ",table:"VehicleType",active:"active",search:["code","name"],fields:[code,name,{name:"wheelCount",label:"จำนวนล้อ",type:"number",required:true}]},
  drivers:{title:"พนักงานขับรถ",table:"Driver",active:"active",search:["code","name"],fields:[code,name,{name:"phone",label:"เบอร์ติดต่อ",max:32}]},
  branches:{title:"ข้อมูลสาขา",table:"Branch",active:"archived",search:["code","name","province"],fields:[code,{...name,label:"ชื่อสาขาทางการ"},
    {name:"destinationType",label:"ประเภทปลายทาง",type:"select",required:true,options:[{value:"BRANCH",label:"สาขา"},{value:"DC",label:"ศูนย์กระจายสินค้า"},{value:"FACTORY",label:"โรงงาน"}]},
    {name:"aliases",label:"ชื่อเรียกอื่น (หนึ่งชื่อต่อบรรทัด)",type:"textarea",max:4000},
    {name:"addressLine",label:"บ้านเลขที่ อาคาร ถนน",required:true,max:500},{name:"subdistrict",label:"ตำบล / แขวง",required:true,max:100},
    {name:"district",label:"อำเภอ / เขต",required:true,max:100},{name:"province",label:"จังหวัด",required:true,max:100},{name:"postalCode",label:"รหัสไปรษณีย์",required:true,max:5},
    {name:"contactName",label:"ชื่อผู้รับ / ผู้ติดต่อ",required:true,max:191},{name:"contactPhone",label:"เบอร์ติดต่อ",required:true,max:32},
    {name:"receivingFromMinute",label:"เริ่มรับสินค้า",type:"time"},{name:"receivingToMinute",label:"สิ้นสุดรับสินค้า",type:"time"},
    {name:"activeFrom",label:"วันที่เริ่มให้บริการ",type:"date",required:true},{name:"activeTo",label:"วันที่สิ้นสุดให้บริการ",type:"date"}]},
  "product-categories":{title:"หมวดสินค้า",table:"ProductCategory",active:"active",search:["code","name"],fields:[code,name,{name:"parentId",label:"หมวดแม่",type:"select",lookup:"product-categories"}]},
  "storage-conditions":{title:"สภาพการเก็บรักษา",table:"StorageCondition",active:"active",search:["code","name"],fields:[code,name]},
  "consignment-categories":{title:"หมวดสิ่งของฝากส่ง",table:"ConsignmentCategory",active:"active",search:["code","name"],fields:[code,name]},
  warehouses:{title:"คลังต้นทาง",table:"Warehouse",active:"active",search:["code","name"],fields:[code,name,{name:"address",label:"ที่อยู่คลัง",type:"textarea",required:true,max:1000}]},
  departments:{title:"แผนก",table:"Department",active:"active",search:["code","name"],fields:[code,name]},
};
