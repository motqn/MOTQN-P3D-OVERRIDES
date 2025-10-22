(function ($) {
  // ----------------- helpers -----------------
  function waitFor(sel, root=document, timeout=15000){
    return new Promise((resolve,reject)=>{
      const first = root.querySelector(sel);
      if (first) return resolve(first);
      const obs = new MutationObserver(()=>{
        const el = root.querySelector(sel);
        if (el){ obs.disconnect(); resolve(el); }
      });
      obs.observe(root,{subtree:true,childList:true});
      setTimeout(()=>{ obs.disconnect(); reject(new Error('timeout '+sel)); }, timeout);
    });
  }

  const parseMoney = s => {
    if (!s) return 0;
    const n = s.replace(/[^0-9.,-]/g,'').replace(',', '.');
    const f = parseFloat(n);
    return isNaN(f) ? 0 : f;
  };
  const fmtMoney = n => (typeof Intl!=='undefined')
    ? new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(n)
    : '$'+n.toFixed(2);

  // get the real plupload instance
  function getUploader($scope){
    try {
      if ($.fn.pluploadQueue) {
        const q = $scope.find('#p3d-bulk-uploader').pluploadQueue();
        if (q && typeof q.getUploader === 'function') return q.getUploader();
      }
    } catch(e){}
    let up = null;
    $scope.find('*').each(function(){
      const d = $(this).data('plupload') || $(this).data('uploader') || this.plupload;
      if (d && typeof d.addFile === 'function') { up = d; return false; }
      if (d && typeof d.getUploader === 'function') { up = d.getUploader(); return false; }
    });
    if (!up && window.plupload && plupload.instances && plupload.instances.length) up = plupload.instances[0];
    return up || null;
  }

  function triggerBrowse($scope){
    const $a = $scope.find('a[id$="_browse"]').first();
    if ($a.length){ $a[0].dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; }
    const $file = $scope.find('input[type="file"][id^="html5_"]').first();
    if ($file.length){ $file[0].click(); return true; }
    return false;
  }

  // ----------------- material/color parsing -----------------
  const NAME_TO_HEX = {
    black:'#111', white:'#eee', red:'#B00020', blue:'#1565C0', gray:'#757575', grey:'#757575',
    silver:'#c0c0c0', green:'#0a7d35', yellow:'#f3c614', orange:'#f97316', purple:'#7e22ce',
    brown:'#7b4d2a', pink:'#e91e63'
  };

  // Prefer data attributes from your plugin; fallback to parsing "Material – Color"
  function parseMatColorSelect($sel){
    const byMaterial = {}; // { "PLA": [{value,label,colorHex,thumb}], ... }
    const selectedVal = $sel.val();

    $sel.find('option').each(function(){
      const $opt = $(this);
      const text = ($opt.text() || '').trim();
      const value = $opt.attr('value') || text;

      const group = $opt.data('group') || $opt.attr('data-group') || guessGroup(text);
      const colorName = ($opt.data('colorname') || $opt.attr('data-colorname') || guessColorName(text) || '').toString();
      const colorHex = $opt.data('color') || $opt.attr('data-color') || NAME_TO_HEX[(colorName||'').toLowerCase()] || null;
      const thumb = $opt.data('img') || $opt.data('image') || $opt.data('preview') ||
                    $opt.attr('data-img') || $opt.attr('data-image') || '';

      if (!byMaterial[group]) byMaterial[group] = [];
      byMaterial[group].push({ value, label: colorName || text, colorHex, thumb });
    });

    Object.keys(byMaterial).forEach(k=>{
      byMaterial[k].sort((a,b)=> a.label.localeCompare(b.label));
    });

    let selectedMat = Object.keys(byMaterial)[0] || '';
    Object.keys(byMaterial).forEach(mat=>{
      if (byMaterial[mat].some(o=>o.value == selectedVal)) selectedMat = mat;
    });

    return { byMaterial, selected: { mat: selectedMat, value: selectedVal } };
  }

  function guessGroup(text){
    const m = text.match(/^(.*?)[\s–-]+\s*.+$/);
    return m ? m[1].trim() : text.trim();
  }
  function guessColorName(text){
    const m = text.match(/^[^-–]+[\s–-]+\s*(.+)$/);
    return m ? m[1].trim() : '';
  }

  function chipHTML(opt){
    if (opt.colorHex) {
      return `<button type="button" class="motqn-color" data-value="${escapeHtml(opt.value)}" data-thumb="${escapeHtml(opt.thumb||'')}" title="${escapeHtml(opt.label)}">
                <span style="background:${opt.colorHex}"></span>
              </button>`;
    }
    return `<button type="button" class="motqn-color motqn-color-text" data-value="${escapeHtml(opt.value)}" data-thumb="${escapeHtml(opt.thumb||'')}" title="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</button>`;
  }

  function escapeHtml(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

  // preview bubble for color chips
  function ensurePreviewBubble(){
    let $b = $('#motqn-chip-preview');
    if (!$b.length) $b = $('<div id="motqn-chip-preview"></div>').appendTo(document.body);
    return $b;
  }
  function positionBubble($b, e){
    const pad = 12;
    $b.css({ left: (e.pageX + pad) + 'px', top: (e.pageY + pad) + 'px' });
  }

  // ----------- preview extraction (canvas -> <img>) -----------
  function buildPreviewNode($li){
    // Try known preview containers first
    const $known = $li.find(
      '.p3d-preview canvas, .p3d-preview img, ' +
      '[class*="preview"] canvas, [class*="preview"] img, ' +
      '[class*="thumb"] img'
    ).first();

    if ($known.length) {
      if ($known.is('canvas') && $known[0].width && $known[0].height && $known[0].toDataURL) {
        try { return `<img src="${$known[0].toDataURL('image/png')}" alt="">`; } catch(e){}
      }
      if ($known.is('img')) return $('<div>').append($known.clone()).html();
    }

    // Fallbacks
    const $canvas = $li.find('canvas').filter((_,c)=>c.width && c.height).first();
    if ($canvas.length && $canvas[0].toDataURL) {
      try { return `<img src="${$canvas[0].toDataURL('image/png')}" alt="">`; } catch(e){}
    }
    const $img = $li.find('img').first();
    if ($img.length) return $('<div>').append($img.clone()).html();

    return '<div class="motqn-thumb-ph"></div>';
  }

  function watchPreview($li, $card){
    const update = () => { $card.find('.motqn-thumb').html(buildPreviewNode($li)); };
    update();
    // re-check a few times because plugin paints later
    setTimeout(update, 300);
    setTimeout(update, 800);
    new MutationObserver(update).observe($li[0], {childList:true, subtree:true, attributes:true});
  }

  // ----------- status under preview -----------
  function extractStatus($li){
    // direct selectors first
    const dims = ($li.find('.p3d-dimensions, .p3d_dimensions, .p3d-dims').first().text() || '').trim();
    const vol  = ($li.find('.p3d-volume, .p3d_volume, .p3d-vol').first().text() || '').trim();
    if (dims || vol) return { dims, vol };

    // fallback: scan visible text that looks like dims/volume
    let foundDims = '', foundVol = '';
    $li.find('*').each(function(){
      const t = $(this).text().trim();
      if (!foundDims && /(\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*(mm|cm)\b)/i.test(t)) foundDims = t;
      if (!foundVol  && /\b\d+(\.\d+)?\s*cm(?:3|³)\b/i.test(t)) foundVol = t;
    });
    return { dims: foundDims, vol: foundVol };
  }

  function watchStatus($li, $card){
    const $box = $card.find('.motqn-status-lines');
    const update = () => {
      const {dims, vol} = extractStatus($li);
      const lines = [];
      if (dims) lines.push(`<div class="motqn-line">${dims}</div>`);
      if (vol)  lines.push(`<div class="motqn-line">${vol}</div>`);
      $box.html(lines.join(''));
    };
    update();
    setTimeout(update, 400);
    new MutationObserver(update).observe($li[0], {childList:true, subtree:true, characterData:true});
  }

  // ----------------- layout + cards -----------------
  function mount($form){
    if ($form.data('motqn-mounted')) return;
    $form.data('motqn-mounted', true);

    const $uploader = $form.find('#p3d-bulk-uploader').first().closest('.plupload_wrapper, #p3d-bulk-uploader');
    if (!$uploader.length) return;

    const $flex = $('<div class="motqn-flex"></div>');
    const $left = $('<div class="motqn-left"></div>');
    $uploader.before($flex);
    $left.append($uploader);
    $flex.append($left);

    const $summary = $(`
      <aside id="motqn-summary" class="motqn-summary">
        <div class="motqn-card">
          <div class="motqn-row"><span>Total Price</span><strong id="motqn-total">$0.00</strong></div>
          <div class="motqn-row"><label><input type="radio" name="motqn-build" value="std" checked> Standard: <span>3 days</span></label></div>
          <label class="motqn-terms"><input type="checkbox" id="motqn-terms"> I agree to terms of use</label>
          <button type="button" class="motqn-btn motqn-cta" id="motqn-submit">Submit Order</button>
          <button type="button" class="motqn-btn" id="motqn-save">Save to Cart</button>
        </div>
      </aside>
    `);
    $flex.append($summary);

    const $drop = $(`
      <div class="motqn-dropzone" id="motqn-drop">
        <button type="button" class="motqn-btn motqn-primary" id="motqn-add-files">Add 3D Files</button>
        <p class="motqn-help">File types: STL, STEP, OBJ, 3MF • Min wall 0.8–1.2mm</p>
      </div>
    `);
    const $cards = $('<div class="motqn-cards"></div>');
    $left.prepend($drop);
    $left.append($cards);

    // hide grey UI completely
    $uploader.find('.plupload_header, .plupload_filelist_header, .plupload_filelist_footer').addClass('motqn-hide');
    $uploader.find('.plupload_content').addClass('motqn-offscreen');  // keep rendering previews

    // wire browse + drag to the REAL uploader
    const uploader = getUploader($uploader);
    $drop.on('click', '#motqn-add-files', (e)=>{ e.preventDefault(); triggerBrowse($uploader); });

    $('#motqn-drop').on('dragover dragenter', function(e){
      e.preventDefault(); e.stopPropagation();
      (e.originalEvent||e).dataTransfer.dropEffect = 'copy';
      $(this).addClass('motqn-drag');
    }).on('dragleave dragend', function(){
      $(this).removeClass('motqn-drag');
    }).on('drop', function(e){
      e.preventDefault(); e.stopPropagation();
      $(this).removeClass('motqn-drag');
      const dt = (e.originalEvent || e).dataTransfer;
      if (uploader && dt && dt.files && dt.files.length) {
        try { uploader.addFile(dt.files); if (uploader.refresh) uploader.refresh(); }
        catch(err){ console.warn('Drop->addFile failed', err);
        }
      }
    });

    // Build/maintain cards
    const $ul = $uploader.find('ul[id$="_filelist"]').first();
    if ($ul.length){
      $ul.children('li').each((_,li)=> addOrUpdateCard($(li), $cards));
      const rows = new MutationObserver(muts=>{
        muts.forEach(m=>{
          (m.addedNodes||[]).forEach(n=>{ if (n.nodeType===1 && n.tagName==='LI') addOrUpdateCard($(n), $cards); });
          (m.removedNodes||[]).forEach(n=>{ if (n.nodeType===1 && n.tagName==='LI') removeCard($(n), $cards); });
        });
        updateTotal($cards);
      });
      rows.observe($ul[0], {childList:true});
    }

    const priceObs = new MutationObserver(()=> updateTotal($cards));
    priceObs.observe($uploader[0], {childList:true, subtree:true});

    // submit/save via plugin
    $(document).off('click.motqnSubmit').on('click.motqnSubmit','#motqn-submit', function(){
      if (!$('#motqn-terms').is(':checked')) { alert('Please accept the terms first.'); return; }
      if (typeof window.p3dSubmitFormBulk === 'function') {
        window.p3dSubmitFormBulk();
        if (window.motqnP3D?.checkoutUrl) setTimeout(()=> location.href = motqnP3D.checkoutUrl, 700);
      } else alert('Submit function not found.');
    });
    $(document).off('click.motqnSave').on('click.motqnSave','#motqn-save', function(){
      if (typeof window.p3dSubmitFormBulk === 'function') {
        window.p3dSubmitFormBulk();
        if (window.motqnP3D?.cartUrl) setTimeout(()=> location.href = motqnP3D.cartUrl, 700);
      }
    });
  }

  function liKey($li){ return $li.attr('id') || ('li-' + Math.random().toString(36).slice(2)); }

  function addOrUpdateCard($li, $cards){
    if ($li.hasClass('plupload_droptext')) return;

    const key = liKey($li);
    $li.attr('data-motqn-key', key);

    const filename = ($li.find('.plupload_file_name').text() || $li.text() || 'Model').trim();

    // price element inside legacy li
    let $unitPrice = $li.find('.plupload_file_price .plupload_total_price, .plupload_file_price, .p3d-unit-price').first();
    if (!$unitPrice.length) $unitPrice = $('<span class="p3d-unit-price" style="display:none"></span>').appendTo($li);

    // locate the combined Material–Color select the plugin renders for this row
    let $legacySel = $li.find('select[name*="material"], select[id*="material"], select[class*="material"]').first();
    if (!$legacySel.length) $legacySel = $li.find('select').first();

    // parse its options into groups (materials) and colors
    const model = $legacySel.length ? parseMatColorSelect($legacySel) : { byMaterial:{}, selected:{ mat:'', value:'' } };
    const mats = Object.keys(model.byMaterial);

    // create / update card
    let $card = $cards.children(`.motqn-card-item[data-key="${key}"]`);
    const fresh = !$card.length;

    if (fresh) {
      $card = $(`
        <div class="motqn-card-item" data-key="${key}">
          <div class="motqn-item">
            <div class="motqn-item-main">
              <div class="motqn-thumb">${buildPreviewNode($li)}</div>
              <div class="motqn-item-body">
                <div class="motqn-title">${escapeHtml(filename)}</div>

                <div class="motqn-under-thumb">
                  <div class="motqn-status-lines"></div>
                </div>

                <div class="motqn-row">
                  <div class="motqn-label">Process</div>
                  <div class="motqn-control"><span class="motqn-chip motqn-chip-active">FDM (Plastic)</span></div>
                </div>

                <div class="motqn-row">
                  <div class="motqn-label">Material</div>
                  <div class="motqn-control">
                    <select class="motqn-select motqn-material">
                      ${mats.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="motqn-row">
                  <div class="motqn-label">Color</div>
                  <div class="motqn-control motqn-colors"></div>
                </div>

                <div class="motqn-row">
                  <div class="motqn-label">Qty</div>
                  <div class="motqn-control"><input type="number" class="motqn-qty" min="1" step="1" value="1"></div>
                </div>

                <div class="motqn-row">
                  <div class="motqn-label">Notes</div>
                  <div class="motqn-control"><textarea class="motqn-notes" rows="2" placeholder="Any special requirements?"></textarea></div>
                </div>

                <div class="motqn-price-row">
                  <div class="motqn-price-label">Price</div>
                  <div class="motqn-price">$0.00</div>
                </div>

                <div class="motqn-card-actions">
                  <a href="#" class="motqn-link motqn-duplicate">Duplicate</a>
                  <a href="#" class="motqn-link motqn-delete">Delete</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
      $cards.append($card);

      // keep preview in sync when canvas appears/updates
      watchPreview($li, $card);
      watchStatus($li, $card);

      // init material + colors
      const $ourMat = $card.find('.motqn-material');
      if (mats.length) $ourMat.val(model.selected.mat);
      renderColors($card, model, model.selected.value, $legacySel);

      $ourMat.on('change', function(){
        const mat = $(this).val();
        const first = (model.byMaterial[mat] && model.byMaterial[mat][0]) ? model.byMaterial[mat][0].value : '';
        renderColors($card, model, first, $legacySel);
        if (first) $legacySel.val(first).trigger('change');
      });

      // legacy select changed by plugin -> sync our UI
      $legacySel.on('change.motqn', function(){
        const val = $(this).val();
        let matOfVal = mats[0] || '';
        mats.forEach(m=>{
          if (model.byMaterial[m].some(o=>o.value==val)) matOfVal = m;
        });
        $ourMat.val(matOfVal);
        renderColors($card, model, val, $legacySel);
      });

      // stats link: click underlying old blue "!" if present
      $card.on('click', '.motqn-stats-link', function(e){
        e.preventDefault();
        const $trigger = $li.find('[title*="Stats"], [title*="stats"], [class*="stats"], .p3d-info, .p3d-stats').first();
        if ($trigger.length) $trigger.trigger('click');
      });

      // delete
      $card.on('click', '.motqn-delete', function(e){
              e.preventDefault();
              $li.remove(); $card.remove(); updateTotal($cards);
            });

            // duplicate: click plugin’s duplicate control if it exists; else safe clone
            // duplicate: use plugin's own control; otherwise keep link disabled
      (function attachDuplicate(){
        const $dupLink = $card.find('.motqn-duplicate');

        // look for the plugin's duplicate control inside this row's <li>
        const $dupTrigger = $li.find('*').filter(function () {
          const el  = this;
          const txt = (el.textContent || '').toLowerCase();
          const cls = (el.className   || '').toLowerCase();
          const ttl = (el.title       || '').toLowerCase();
          return /duplicate/.test(txt) || /duplicate/.test(cls) || /duplicate/.test(ttl);
        }).first();

        if ($dupTrigger.length) {
          // clicking our link triggers the plugin's real duplicate action
          $dupLink.off('click').on('click', function (e) {
            e.preventDefault();
            $dupTrigger.trigger('click');
          });
        } else {
          // no safe duplicate available in this build — disable but keep visible
          $dupLink
            .addClass('motqn-disabled')
            .off('click')
            .on('click', function (e) { e.preventDefault(); });
        }
      })();



    } else {
      // update filename
      $card.find('.motqn-title').text(filename);
      // preview might appear later; keep watcher on
      watchPreview($li, $card);
    }

    // mirror price into our blue price area
    const $priceBox = $card.find('.motqn-price');
    const syncPrice = () => { const raw = $unitPrice.text().trim(); if (raw) $priceBox.text(raw); };
    syncPrice();
    new MutationObserver(syncPrice).observe($unitPrice[0], {childList:true, subtree:true});
  }

  function renderColors($card, model, selectedValue, $legacySel){
    const mat = $card.find('.motqn-material').val();
    const list = model.byMaterial[mat] || [];
    const $box = $card.find('.motqn-colors');
    $box.empty().append(list.map(chipHTML).join(''));

    // set active
    if (selectedValue){
      $box.find(`.motqn-color[data-value="${CSS.escape(String(selectedValue))}"]`).addClass('active');
    } else if (list[0]) {
      $box.find(`.motqn-color[data-value="${CSS.escape(String(list[0].value))}"]`).addClass('active');
    }

    // clicking a chip -> update legacy select (pricing still handled by plugin)
    $box.off('click.motqn').on('click.motqn','.motqn-color', function(){
      const v = $(this).data('value');
      $box.find('.motqn-color').removeClass('active');
      $(this).addClass('active');
      if ($legacySel && $legacySel.length) $legacySel.val(v).trigger('change');
    });

    // hover preview
    const $bubble = ensurePreviewBubble();
    $box.off('mouseenter.motqn mousemove.motqn mouseleave.motqn');
    $box.on('mouseenter.motqn', '.motqn-color', function(e){
      const url = $(this).data('thumb');
      if (!url) return;
      $bubble.html(`<img src="${url}" alt="" />`).addClass('show');
      positionBubble($bubble, e);
    }).on('mousemove.motqn', '.motqn-color', function(e){
      positionBubble($bubble, e);
    }).on('mouseleave.motqn', '.motqn-color', function(){
      $bubble.removeClass('show').empty();
    });
  }

  function removeCard($li, $cards){
    const key = $li.attr('data-motqn-key');
    if (key) $cards.children(`.motqn-card-item[data-key="${key}"]`).remove();
  }

  function updateTotal($cards){
    let total = 0;
    $cards.find('.motqn-price').each(function(){ total += parseMoney($(this).text()); });
    $('#motqn-total').text(fmtMoney(total));
  }

  // ----------------- boot -----------------
  $(function(){
    waitFor('#p3d-bulk-form').then(form => mount($(form)));
  });
})(jQuery);
