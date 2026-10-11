'use strict';
// Original vector illustrations: scalable, offline, with no external image requests.
const SUBJECT_ART=[
'<circle cx="70" cy="55" r="5" fill="currentColor"/><ellipse cx="70" cy="55" rx="46" ry="17"/><ellipse cx="70" cy="55" rx="46" ry="17" transform="rotate(60 70 55)"/><ellipse cx="70" cy="55" rx="46" ry="17" transform="rotate(120 70 55)"/><circle cx="109" cy="47" r="3" fill="currentColor"/>',
'<path d="M48 12C104 40 36 70 92 98M92 12C36 40 104 70 48 98"/><path d="M49 20h42M56 34h28M60 47h20M54 61h32M49 75h42M57 89h26"/>',
'<circle cx="70" cy="55" r="39"/><ellipse cx="70" cy="55" rx="18" ry="39"/><path d="M32 43h76M32 67h76M70 16v78"/><path d="M23 19l7 7M111 84l7 7"/>',
'<path d="M70 33C56 23 38 25 25 29v53c14-5 29-5 45 3 16-8 31-8 45-3V29c-13-4-31-6-45 4Zm0 0v52M37 43l20 2M37 55l20 2M83 45l20-2M83 57l20-2"/><path d="M22 90c17-4 31-3 48 4 17-7 31-8 48-4"/>',
'<rect x="42" y="27" width="56" height="56" rx="8"/><rect x="54" y="39" width="32" height="32" rx="3"/><path d="M51 15v12M64 15v12M77 15v12M90 15v12M51 83v12M64 83v12M77 83v12M90 83v12M30 36h12M30 49h12M30 62h12M30 75h12M98 36h12M98 49h12M98 62h12M98 75h12"/>',
'<circle cx="70" cy="55" r="28"/><ellipse cx="70" cy="55" rx="53" ry="14" transform="rotate(-25 70 55)"/><path d="M58 30c3 20 27 14 26 33S67 73 72 81"/><circle cx="31" cy="26" r="3" fill="currentColor"/><path d="M111 19v10M106 24h10"/>',
'<path d="M37 86V34l33-18 33 18v52M25 86h90M49 42v29M70 42v29M91 42v29M33 34h74"/><circle cx="70" cy="28" r="3"/><path d="M23 18v10M18 23h10M117 68v10M112 73h10"/>',
'<circle cx="70" cy="47" r="24"/><path d="M58 69l-5 29 17-9 17 9-5-29M64 41l6-10 6 10 11 2-8 8 2 12-11-6-11 6 2-12-8-8Z"/><path d="M32 42c-15 20-2 42 14 47M108 42c15 20 2 42-14 47"/>'
];
const subjectArt=i=>`<div class="subject-art art-${i}" aria-hidden="true"><svg viewBox="0 0 140 110" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${SUBJECT_ART[i]}</svg><span class="art-grid"></span></div>`;
