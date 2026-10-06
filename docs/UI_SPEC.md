# Thai UI specification

## Visual system

Recreate the supplied mockup's red primary actions, white cards, light-gray background, rounded controls, subtle borders and clear Thai typography. The three panels in the image illustrate alternative states of one search screen. Implement one responsive application with three tabs.

Proposed tokens: primary #E60023, primary hover #BF001D, page #F6F8FA, surface #FFFFFF, text #111827, muted #64748B, border #E2E8F0. Verify accessible contrast and adjust secondary text if needed. Use a locally hosted licensed Thai font such as Noto Sans Thai, 16 px base text, 8 px spacing rhythm, 12–16 px card radius and at least 44 px touch targets. Use approved brand assets supplied by the owner; a text wordmark is an acceptable development placeholder.

Design for desktop 1440 px, tablet 768 px and mobile 390 px. Desktop content has a readable centered maximum width. Mobile cards stack, navigation collapses and tables become accessible summary cards or clearly labeled horizontal scroll areas. Avoid clipped Thai text. Provide keyboard focus, real labels, semantic controls and status text/icons in addition to color.

## Navigation and screens

User navigation: ค้นหาเส้นทาง, รอบรถทั้งหมด, สาขาทั้งหมด, ฝากของส่งรถ, ประวัติฝากส่ง. Show จัดการหลังบ้าน only to authorized roles. The backend adds ภาพรวม, แผนเดินรถรายวัน, เส้นทาง, ข้อมูลรถ, ข้อมูลสาขา, หมวดสินค้า, ผู้ใช้งานและสิทธิ์, นำเข้าข้อมูล and ประวัติการเปลี่ยนแปลง.

Search page: title ค้นหาเส้นทางเดินรถ หมูอินเตอร์ and subtitle ค้นหาสายรถตามสาขา เวลา และช่วงเวลา. Show metric cards for published trips, available time span and three search modes. Derive values from the selected service date and visible data; use รอบรถ for trip counts rather than inaccurately calling them unique routes.

Place service date, round and product category filters above the tab area. Use tabs ค้นหาจากสาขา, เลือกเวลา and เลือกช่วงเวลา. Branch mode has autocomplete with branch code/official name and a clear action. Time mode has selectable chips. Range mode has start/end controls and a visible inclusive-boundary explanation. Show the time basis selector near time filters.

Results show a red-tinted count badge, sort control, loading state, empty state, error state and pagination. Columns: เส้นทาง, รอบ, เวลาเริ่มขึ้นของ, เวลาออกรถ, หมวดสินค้า, ทะเบียนรถ and รายละเอียด. Route details show ordered stops, matched branch, eligible categories, vehicle and authorized contact. Show ยังไม่ระบุ when a time is unknown. The ฝากของกับรอบนี้ action pre-fills an eligible real trip and branch after authorization.

Consignment page: title ฝากของส่งรถ. Group fields into ผู้ฝากและต้นทาง, ปลายทางและรอบรถ, รายการสิ่งของ, จำนวนหีบห่อ, เอกสารแนบ and ตรวจสอบก่อนส่ง. Display eligibility/cutoff errors near the trip selector. Use เพิ่มรายการ, บันทึกฉบับร่าง and ส่งคำขอ. Confirm that item quantity and package count are independent; show an example of 30 posters in 3 boxes only as sample help text.

Consignment detail: stable number, Thai status, branch, trip/round, vehicle, item and package summary, event timeline, attachments, receipt discrepancies and permitted actions. Use a package scan/manual-entry receipt flow. History supports filtered search and CSV export within user scope. Reprint and correction actions show the current label version and explain revocation.

Backend daily planning: service date and revision selector; separate round 1/2/3 views; trip list with vehicle, route, categories and occupancy times; add/edit/copy/reduce/merge/cancel actions; coverage matrix by branch, round and pork/chicken; conflict panel; ตรวจสอบความครบถ้วน and เผยแพร่แผน. Never show publish success when validation fails.

Master screens use searchable tables, active/archive filters, server-side pagination and Thai add/edit forms. Vehicle fields explicitly include ทะเบียนรถ, จังหวัด, ยี่ห้อ, รุ่น, สี, ประเภทรถ, จำนวนล้อ and storage/capacity details. Branch forms include code, official name, aliases, full printable address, recipient/contact and effective dates. Show dependency-aware archive guidance when deletion is blocked.

## Thai microcopy and print

Use consistent translations: draft ฉบับร่าง; pending review รอตรวจสอบ; assigned จัดรถแล้ว; warehouse received คลังรับของแล้ว; loaded ขึ้นรถแล้ว; in transit อยู่ระหว่างขนส่ง; partially received รับบางส่วน; issue พบปัญหา; received รับครบแล้ว; closed ปิดงาน; cancelled ยกเลิก; returned ส่งคืน; rejected ไม่อนุมัติ. User-facing errors must explain a corrective next step without exposing technical stack traces.

Display dates in a consistent Thai locale with an explicit พ.ศ. calendar convention; accept/store ISO Gregorian service dates internally. Display times in 24-hour HH:mm format with น. where useful. Use Asia/Bangkok consistently. Do not mix calendar years within one workflow.

Print layouts are monochrome-readable and omit navigation/buttons. Preview A4 four-label pages and 100 x 150 mm stickers at actual scale. Include Thai branch/address text, clear package numbering, safe QR lookup and current label version. Test long addresses and page boundaries. Do not shrink essential recipient text to fit an overcrowded label.

## Visual acceptance

Capture search in all three modes, daily planning, vehicle edit, branch edit, new consignment, history/detail and both print formats. Compare against the reference for layout, hierarchy, spacing and red emphasis. Test loading, empty, validation, permission denied and network failure states. Record screenshots and viewport sizes in docs/PROGRESS.md. Never claim visual fidelity from a successful build alone.
