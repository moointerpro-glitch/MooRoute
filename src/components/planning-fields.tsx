"use client";
export const kindLabels:Record<string,string>={BRANCH_DELIVERY:"ส่งสินค้าสาขา",INBOUND_DC:"รับสินค้าเข้าคลัง",VAN_SALES:"รถขายสินค้า",OTHER:"ประเภทเดิมอื่น ๆ"};
export const statusLabels:Record<string,string>={DRAFT:"ฉบับร่าง",PUBLISHED:"เผยแพร่แล้ว",SUPERSEDED:"ฉบับก่อนหน้า",ASSIGNED:"จัดรถแล้ว",WAREHOUSE_RECEIVED:"คลังรับของแล้ว",LOADED:"ขึ้นรถแล้ว",IN_TRANSIT:"อยู่ระหว่างขนส่ง",RECEIVED:"รับครบแล้ว",PARTIALLY_RECEIVED:"รับบางส่วน",CLOSED:"ปิดงาน",CANCELLED:"ยกเลิก",ISSUE:"พบปัญหา",RETURNED:"ส่งคืน"};
export const beDate=(iso:string)=>`${iso.slice(8,10)}/${iso.slice(5,7)}/${Number(iso.slice(0,4))+543}`;
export function isoDate(text:string){const m=text.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0xe50)).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m||Number(m[3])<2400)throw Error("กรุณาระบุวันที่เป็น วัน/เดือน/ปี พ.ศ.");const v=`${Number(m[3])-543}-${m[2]}-${m[1]}`,d=new Date(`${v}T00:00:00Z`);if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==v)throw Error("วันที่ไม่ถูกต้อง");return v;}
export const localInstant=(value:string|null)=>value?(()=>{const s=new Date(Date.parse(value)+7*3600000).toISOString();return `${beDate(s)} ${s.slice(11,16)}`;})():"";
export function utcInstant(value:string){if(!value.trim())return null;const [day,time]=value.trim().split(" ");if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time??""))throw Error("กรุณาระบุเวลาเป็น ชั่วโมง:นาที");return new Date(`${isoDate(day)}T${time}:00+07:00`).toISOString();}
export const minuteText=(v:number|null)=>v===null?"":`${String(Math.floor(v/60)%24).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`;
export const minuteValue=(s:string)=>s?Number(s.slice(0,2))*60+Number(s.slice(3,5)):null;
export const field=(f:FormData,name:string)=>String(f.get(name)??"").trim();
export function DateField({name,label,value,required=true}:{name:string;label:string;value:string;required?:boolean}){return <label>{label}<input name={name} defaultValue={value?beDate(value):""} placeholder="วว/ดด/ปปปป พ.ศ." required={required} pattern="[0-9๐-๙]{2}/[0-9๐-๙]{2}/[0-9๐-๙]{4}"/></label>;}
