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

Consignment page: title ฝากของส่งรถ. Group fields into ผู้ฝากและต้นทาง, ปลายทางและรอบรถ, สิ่งที่ฝากส่ง, รายการสิ่งของข้างใน (ไม่บังคับ), เอกสารแนบ and ตรวจสอบก่อนส่ง. Display eligibility/cutoff errors near the trip selector. D234: สิ่งที่ฝากส่ง is a required table the sender fills in line by line (บรรจุใส่ with a list plus อื่น ๆ and a typed name, จำนวน, รายละเอียด, optional น้ำหนักต่อชิ้น in kilograms) with เพิ่มแถว and a running total; a total above 50 pieces needs an on-screen confirmation. The item list is optional with เพิ่มรายการสิ่งของ and a checkbox asking the branch to count the contents. Use บันทึกฉบับร่าง and ส่งคำขอ.

Consignment detail: stable number, Thai status, branch, trip/round, vehicle, what is being sent as one row per packaging line (kind, count, contents, weight, where the pieces are now) with individual pieces on demand, the optional item list, event timeline, attachments, receipt discrepancies and permitted actions. People read "ชิ้นที่ 2/5 · กล่อง", never an internal package code; custody is worded as a place (อยู่กับผู้ฝาก, อยู่ที่คลัง, อยู่บนรถ). Use a scan/manual-entry receipt flow that accepts the QR code, the piece number printed on the label or the full code. History supports filtered search and CSV export within user scope. Reprint and correction actions show the current label version and explain revocation.

Backend daily planning: service date and revision selector; separate round 1/2/3 views; trip list with vehicle, route, categories and occupancy times; add/edit/copy/reduce/merge/cancel actions; coverage matrix by branch, round and pork/chicken; conflict panel; ตรวจสอบความครบถ้วน and เผยแพร่แผน. Never show publish success when validation fails.

Master screens use searchable tables, active/archive filters, server-side pagination and Thai add/edit forms. Vehicle fields explicitly include ทะเบียนรถ, จังหวัด, ยี่ห้อ, รุ่น, สี, ประเภทรถ, จำนวนล้อ and storage/capacity details. Branch forms include code, official name, aliases, full printable address, recipient/contact and effective dates. Show dependency-aware archive guidance when deletion is blocked.

## Thai microcopy and print

Use consistent translations: draft ฉบับร่าง; pending review รอตรวจสอบ; assigned จัดรถแล้ว; warehouse received คลังรับของแล้ว; loaded ขึ้นรถแล้ว; in transit อยู่ระหว่างขนส่ง; partially received รับบางส่วน; issue พบปัญหา; received รับครบแล้ว; closed ปิดงาน; cancelled ยกเลิก; returned ส่งคืน; rejected ไม่อนุมัติ. User-facing errors must explain a corrective next step without exposing technical stack traces.

Display dates in a consistent Thai locale with an explicit พ.ศ. calendar convention; accept/store ISO Gregorian service dates internally. Display times in 24-hour HH:mm format with น. where useful. Use Asia/Bangkok consistently. Do not mix calendar years within one workflow.

Time entry (D229): use a dedicated numeric HH:MM field with a clock icon, not a select dropdown. The icon opens a Thai popup with independently scrollable hour/minute wheels, arrow buttons and explicit confirmation. Support direct typing, minute precision, mouse, touch and keyboard. Enforce 00:00–23:59; show invalid entry for correction. Cancel/Escape/outside dismissal do not commit provisional selections. Unknown times stay empty until the user confirms a value. Apply this shared control to search range endpoints, planning, templates and master-data time/date-time fields.

Print layouts are monochrome-readable and omit navigation/buttons. Preview A4 four-label pages and 100 x 150 mm stickers at actual scale. Include Thai branch/address text, clear piece numbering, the packaging kind and contents, one sender line (name, phone, department), safe QR lookup and current label version. Packaging and sender are single lines cut with an ellipsis so the label height never depends on them. Test long addresses and page boundaries. Do not shrink essential recipient text to fit an overcrowded label.

## Visual acceptance

Capture search in all three modes, daily planning, vehicle edit, branch edit, new consignment, history/detail and both print formats. Compare against the reference for layout, hierarchy, spacing and red emphasis. Test loading, empty, validation, permission denied and network failure states. Record screenshots and viewport sizes in docs/PROGRESS.md. Never claim visual fidelity from a successful build alone.

## Planning interaction update (D230)

Trip, route and template editing opens a dedicated page with contextual back navigation. Date/revision/tab state must survive return and refresh. Trip submission saves and checks a draft in one action; publishing remains separate. Show details and missing-cell fixes in a focus-contained dialog; keep the underlying list position. Use explicit confirmation for publish/cancel/remove/merge, prevent duplicate pending submission, warn before discarding modified fields, and retain input after failure. Group each round once above pork/chicken columns. Show exact category-code problems and link to master data; never infer canonical categories from their display names. Vehicle/time readiness must not be described as complete branch coverage.

## Back-office interaction update (D231)

Group dashboard cards by operational work, people/places and vehicle/reference data while retaining permission filtering. Master/account list filters must survive editor return. Provide contextual back links, explicit row actions, grouped long forms and sticky save controls. Warn before discarding modified fields and keep them after request failures. Use focus-contained native confirmation dialogs for delete/archive, account state and temporary password changes. Keep action triggers mounted for focus restoration. Import history links to a dedicated upload page with a Thai file picker and templates; mapping changes are provisional until saved, and commit/reject requires a descriptive confirmation. Preserve existing server checks.

D232 refines D230/D231: do not add a second return control when an existing one serves the same destination. Keep the established placement, use a visible left arrow and destination-specific Thai label, and retain the dirty-form warning. Long editors keep their footer return; existing account details keep their original top return. Navigation and cancelled-trip restoration are distinct actions.

D233: ฝากของส่งรถ shows an initially empty required dropdown named แผนกผู้ส่ง containing active departments. Explain that it is selected for this request and does not require prior account membership; authorized departmental readers can see the submitted request. Show the selected department in the pre-submit review and retain it when reopening a draft. If a draft's department has closed, identify the unavailable prior selection and require a replacement. Account administration labels department membership optional and explains its separate history-read purpose.
