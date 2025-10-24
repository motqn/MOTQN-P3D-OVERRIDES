/**
 * jquery.plupload.queue.js
 *
 * Copyright 2009, Moxiecode Systems AB
 * Released under GPL License.
 *
 * License: http://www.plupload.com/license
 * Contributing: http://www.plupload.com/contributing
 */

/* global jQuery:true, alert:true */

/**
jQuery based implementation of the Plupload API - multi-runtime file uploading API.

To use the widget you must include _jQuery_. It is not meant to be extended in any way and is provided to be
used as it is.

@example
	<!-- Instantiating: -->
	<div id="uploader">
		<p>Your browser doesn't have Flash, Silverlight or HTML5 support.</p>
	</div>

	<script>
		$('#uploader').pluploadQueue({
			url : '../upload.php',
			filters : [
				{title : "Image files", extensions : "jpg,gif,png"}
			],
			rename: true,
			flash_swf_url : '../../js/Moxie.swf',
			silverlight_xap_url : '../../js/Moxie.xap',
		});
	</script>

@example
	// Retrieving a reference to plupload.Uploader object
	var uploader = $('#uploader').pluploadQueue();

	uploader.bind('FilesAdded', function() {
		
		// Autostart
		setTimeout(uploader.start, 1); // "detach" from the main thread
	});

@class pluploadQueue
@constructor
@param {Object} settings For detailed information about each option check documentation.
	@param {String} settings.url URL of the server-side upload handler.
	@param {Number|String} [settings.chunk_size=0] Chunk size in bytes to slice the file into. Shorcuts with b, kb, mb, gb, tb suffixes also supported. `e.g. 204800 or "204800b" or "200kb"`. By default - disabled.
	@param {String} [settings.file_data_name="file"] Name for the file field in Multipart formated message.
	@param {Array} [settings.filters=[]] Set of file type filters, each one defined by hash of title and extensions. `e.g. {title : "Image files", extensions : "jpg,jpeg,gif,png"}`. Dispatches `plupload.FILE_EXTENSION_ERROR`
	@param {String} [settings.flash_swf_url] URL of the Flash swf.
	@param {Object} [settings.headers] Custom headers to send with the upload. Hash of name/value pairs.
	@param {Number|String} [settings.max_file_size] Maximum file size that the user can pick, in bytes. Optionally supports b, kb, mb, gb, tb suffixes. `e.g. "10mb" or "1gb"`. By default - not set. Dispatches `plupload.FILE_SIZE_ERROR`.
	@param {Number} [settings.max_retries=0] How many times to retry the chunk or file, before triggering Error event.
	@param {Boolean} [settings.multipart=true] Whether to send file and additional parameters as Multipart formated message.
	@param {Object} [settings.multipart_params] Hash of key/value pairs to send with every file upload.
	@param {Boolean} [settings.multi_selection=true] Enable ability to select multiple files at once in file dialog.
	@param {Boolean} [settings.prevent_duplicates=false] Do not let duplicates into the queue. Dispatches `plupload.FILE_DUPLICATE_ERROR`.
	@param {String|Object} [settings.required_features] Either comma-separated list or hash of required features that chosen runtime should absolutely possess.
	@param {Object} [settings.resize] Enable resizng of images on client-side. Applies to `image/jpeg` and `image/png` only. `e.g. {width : 200, height : 200, quality : 90, crop: true}`
		@param {Number} [settings.resize.width] If image is bigger, it will be resized.
		@param {Number} [settings.resize.height] If image is bigger, it will be resized.
		@param {Number} [settings.resize.quality=90] Compression quality for jpegs (1-100).
		@param {Boolean} [settings.resize.crop=false] Whether to crop images to exact dimensions. By default they will be resized proportionally.
	@param {String} [settings.runtimes="html5,flash,silverlight,html4"] Comma separated list of runtimes, that Plupload will try in turn, moving to the next if previous fails.
	@param {String} [settings.silverlight_xap_url] URL of the Silverlight xap.
	@param {Boolean} [settings.unique_names=false] If true will generate unique filenames for uploaded files.

	@param {Boolean} [settings.dragdrop=true] Enable ability to add file to the queue by drag'n'dropping them from the desktop.
	@param {Boolean} [settings.rename=false] Enable ability to rename files in the queue.
	@param {Boolean} [settings.multiple_queues=true] Re-activate the widget after each upload procedure.
*/
;(function($, o) {
	var uploaders = {};
	var analyse_queue = {};

	function _(str) {
		return plupload.translate(str) || str;
	}

        function renderUI(id, target) {
                // Remove all existing non plupload items
                target.contents().each(function(i, node) {
                        node = $(node);

                        if (!node.is('.plupload')) {
                                node.remove();
                        }
                });

                target.prepend(
                        '<div class="plupload_wrapper plupload_scroll motqn-uploader">' +
                                '<div id="' + id + '_container" class="plupload_container">' +
                                '<div class="plupload motqn-uploader__grid">' +
                                        '<div class="motqn-uploader__main">' +
                                                '<section class="motqn-uploader__upload-section" aria-label="' + _('Upload files') + '">' +
                                                        '<div class="plupload_progress motqn-progress">' +
                                                                '<div class="plupload_progress_container">' +
                                                                        '<div class="plupload_progress_bar"></div>' +
                                                                '</div>' +
                                                        '</div>' +
                                                        '<div class="motqn-uploader__dropzone" id="' + id + '_dropzone">' +
                                                                '<div class="motqn-uploader__dropzone-message">' +
                                                                        '<div class="motqn-uploader__dropzone-icon" aria-hidden="true"></div>' +
                                                                        '<p class="motqn-uploader__dropzone-text">' + _('Drag & drop files here or click below to browse.') + '</p>' +
                                                                        '<div class="motqn-uploader__dropzone-actions">' +
                                                                                '<div class="plupload_buttons">' +
                                                                                        '<a href="#" class="plupload_button plupload_add motqn-button motqn-button--primary" id="' + id + '_browse">' + _('Add 3D Files') + '</a>' +
                                                                                        '<a href="#" style="display:none;" class="plupload_button plupload_start motqn-button motqn-button--ghost">' + _('Start Upload') + '</a>' +
                                                                                '</div>' +
                                                                                '<span class="plupload_upload_status"></span>' +
                                                                        '</div>' +
                                                                '</div>' +
                                                        '</div>' +
                                                '</section>' +
                                                '<section class="motqn-uploader__files-section motqn-uploader__files-section--empty" aria-label="' + _('Files in queue') + '">' +
                                                        '<ul id="' + id + '_filelist" class="plupload_filelist motqn-card-list"></ul>' +
                                                '</section>' +
                                        '</div>' +
                                                '<aside class="motqn-summary">' +
                                                        '<div class="motqn-summary__card">' +
                                                                '<h3 class="motqn-summary__title">' + _('Charge Details') + '</h3>' +
                                                                '<dl class="motqn-summary__list">' +
                                                                        '<div class="motqn-summary__item">' +
                                                                                '<dt>' + _('Total Price') + '</dt>' +
                                                                                '<dd><span class="plupload_total_price">&nbsp;</span></dd>' +
                                                                        '</div>' +
                                                                        '<div class="motqn-summary__item">' +
                                                                                '<dt>' + _('Upload Progress') + '</dt>' +
                                                                                '<dd><span class="plupload_total_status">0%</span></dd>' +
                                                                        '</div>' +
                                                                        '<div class="motqn-summary__item">' +
                                                                                '<dt>' + _('Total Size') + '</dt>' +
                                                                                '<dd><span class="plupload_total_file_size">0 b</span></dd>' +
                                                                        '</div>' +
                                                                '</dl>' +
                                                                '<div class="motqn-summary__actions">' +
                                                                        '<button type="button" class="motqn-button motqn-button--primary motqn-summary__primary">' + _('Submit Order') + '</button>' +
                                                                        '<button type="button" class="motqn-button motqn-button--ghost motqn-summary__secondary">' + _('Save to Cart') + '</button>' +
                                                                '</div>' +
                                                        '</div>' +
                                                '</aside>' +
                                        '</div>' +
                                '</div>' +
                                '<input type="hidden" id="' + id + '_count" name="' + id + '_count" value="0" />' +
                        '</div>'
                );
        }

	$.fn.pluploadQueue = function(settings) {
		if (settings) {
			this.each(function() {
				var uploader, target, id, contents_bak;

				target = $(this);
				id = target.attr('id');

				if (!id) {
					id = plupload.guid();
					target.attr('id', id);
				}

                                contents_bak = target.html();
                                renderUI(id, target);

                                $('div.plupload_progress', target).hide();

				settings = $.extend({
					dragdrop : true,
					browse_button : id + '_browse',
					container : id
				}, settings);

				// Enable drag/drop (see PostInit handler as well)
                                if (settings.dragdrop) {
                                        settings.drop_element = id + '_dropzone';
                                }

				uploader = new plupload.Uploader(settings);

				uploaders[id] = uploader;

				function handleStatus(file) {
					var actionClass;

					if (file.status == plupload.DONE) {
//						actionClass = 'plupload_done';
						actionClass = 'plupload_delete';
					}

					if (file.status == plupload.FAILED) {
						actionClass = 'plupload_failed';
					}

					if (file.status == plupload.QUEUED) {
						actionClass = 'plupload_delete';
					}

					if (file.status == plupload.UPLOADING) {
						actionClass = 'plupload_uploading';
					}

					var icon = $('#' + file.id).attr('class', actionClass).find('a').css('display', 'inline-block');
					if (file.hint) {
						icon.attr('title', file.hint);	
					}
				}

				function updateTotalProgress() {
					$('span.plupload_total_status', target).html(uploader.total.percent + '%');
					$('div.plupload_progress_bar', target).css('width', uploader.total.percent + '%');
					$('span.plupload_upload_status', target).html(
						o.sprintf(_('Uploaded %d/%d files'), uploader.total.uploaded, uploader.files.length)
					);
				}

                                function updateList() {
                                        var fileList = $('ul.plupload_filelist', target).html(''), inputCount = 0, inputHTML,
                                                dropzone = $('#' + id + '_dropzone', target),
                                                filesSection = $('.motqn-uploader__files-section', target);

					var update_html = true;
					$.each(uploader.files, function(i, file) {
						inputHTML = '';
						//console.log('existing li #'+file.id, jQuery('#'+file.id).html());
//console.log('existing input for #'+file.id, jQuery('#'+file.id).find('.plupload_file_qty input'));
/*						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (p3d.analyse_queue[file.id].uploaded) update_html = false;
//							console.log('queue uploaded ? '+typeof(p3d.analyse_queue[file.id].uploaded));
						}
*/						


						if (file.status == plupload.DONE) {
							if (file.target_name) {
								inputHTML += '<input type="hidden" name="' + id + '_' + inputCount + '_tmpname" value="' + plupload.xmlEncode(file.target_name) + '" />';
							}

							inputHTML += '<input type="hidden" name="' + id + '_' + inputCount + '_name" value="' + plupload.xmlEncode(file.name) + '" />';
							inputHTML += '<input type="hidden" name="' + id + '_' + inputCount + '_status" value="' + (file.status == plupload.DONE ? 'done' : 'failed') + '" />';
	
							inputCount++;

							$('#' + id + '_count').val(inputCount);
							p3d.analyse_queue[file.id].uploaded=true;
						}
						
/*						var material_attribute = '<select class="p3d_bulk_attribute p3d_bulk_attribute_material">';
//console.log(p3d_materials)
						jQuery.each(p3d_materials, function( index, object ) {
//							console.log( index + ": " + object.id );
						});
						
						material_attribute += '</select>';
*/
//console.log(file.status);
						var file_ext = file.name.split('.').pop().toLowerCase();
						var material_attribute = $('#p3d_materials_bulk_template').html();
						var printer_attribute = $('#p3d_printers_bulk_template').html();
						var coating_attribute = $('#p3d_coatings_bulk_template').html();
						var infill_attribute = $('#p3d_infills_bulk_template').html();
						var postprocessing_attribute = $('#p3d_postprocessings_bulk_template').html();
						var custom_attribute = $('#p3d_custom_attributes_bulk_template tbody').html();
						var unit_attribute = $('#p3d_units_bulk_template').html();
                                                var qty_label = 'Quantity';

                                                if (typeof p3d.text_bulk_qty !== 'undefined') {
                                                        qty_label = p3d.text_bulk_qty;
                                                } else if (typeof p3d.text_bulk_quantity !== 'undefined') {
                                                        qty_label = p3d.text_bulk_quantity;
                                                }

                                                var attributes = '<table class="p3d-stats-bulk">';
                                                attributes += '<tr class="p3d-row-qty"><td>' + qty_label + '</td><td><div class="plupload_file_qty"><input name="' + file.id + '_qty" type="number" min="1" step="1" value="1" onchange="p3dSelectQTYBulk(this)"></div></td></tr>';

						if (p3d.selection_order=='materials_printers') {
							attributes += '<tr style="'+(p3d.show_materials!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_material+'</td><td>'+material_attribute+'</td></tr>';
							attributes += '<tr style="'+(p3d.show_printers!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_printer+'</td><td>'+printer_attribute+'</td></tr>';
						}
						else if (p3d.selection_order=='printers_materials') {
							attributes += '<tr style="'+(p3d.show_printers!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_printer+'</td><td>'+printer_attribute+'</td></tr>';
							attributes += '<tr style="'+(p3d.show_materials!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_material+'</td><td>'+material_attribute+'</td></tr>';
						}

						attributes += '<tr style="'+(p3d.show_coatings!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_coating+'</td><td>'+coating_attribute+'</td></tr>';
						attributes += '<tr style="'+(p3d.show_infills!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_infill+'</td><td>'+infill_attribute+'</td></tr>';
						attributes += '<tr style="'+(p3d.show_postprocessings!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_postprocessing+'</td><td>'+postprocessing_attribute+'</td></tr>';
						attributes += '<tr style="'+(p3d.show_scale!="on" ? "display:none;" : "")+'"><td>'+p3d.text_bulk_unit+'</td><td>'+unit_attribute+'</td></tr>';

						if (file_ext=='dxf' || file_ext=='svg' || file_ext=='eps' || file_ext=='pdf') {
							//inject cutting instructions here
							//var cutting_instructions_html = '<div class="p3d-cutting-instructions">'+p3d.text_cutting_instructions;
							var selects_html='';
							if (typeof(p3d.analyse_queue[file.id]) != 'undefined' && typeof(p3d.analyse_queue[file.id].colors) != 'undefined') {
								jQuery.each( p3d.analyse_queue[file.id].colors, function( key, color ) {
									if (typeof(color)=='undefined') return;	
	 
									selects_html+='<tr>';
									selects_html+='<td><div class="p3d-circle" style="color:'+color+';"></div></td>';
									selects_html+='<td>';
									selects_html+='<select autocomplete="off" onchange="p3dSelectCuttingInstructionsBulk(\''+file.id+'\', this)" name="p3d_cutting_instructions[\''+color+'\']">';
		
									if (p3d.laser_cutting_cut=='on') {
										selects_html+='<option value="cut">'+p3d.text_cut;
									}
									if (p3d.laser_cutting_engrave=='on') {
										selects_html+='<option value="engrave">'+p3d.text_engrave;
									}
									if (p3d.laser_cutting_ignore=='on') {
										selects_html+='<option value="ignore">'+p3d.text_ignore;
									}
									selects_html+='</select>';
									selects_html+='</td>';
									selects_html+='</tr>';
				
								});
								//cutting_instructions_html+=selects_html;
								//cutting_instructions_html+='</div>';
								if (selects_html.length) {
//									jQuery('#'+file_id).find('.p3d-stats-bulk').append(selects_html);
									attributes += selects_html;
								}
							}
						}

						if (custom_attribute) {
							attributes += custom_attribute;
						}

						if (p3d.pricing!='checkout') attributes += '<tr><td>Notes</td><td><textarea onchange=p3dSaveComments(this) class="p3d-bulk-comments" rows="2"></textarea></td></tr>';
						//todo custom attrs

						attributes += '</table>';
						if (typeof(file.price)=='undefined') file.price = 0;

						var html_price = file.price;

						if (file.percent==99 && file.status==5) {
							file.percent = 100;
						}
//						console.log(file.percent, file.status)
						var html_status = p3d.text_bulk_uploading+' ' + file.percent + '%';

						var html_stats = 'Click Calculate button to show stats';
						var stats_style = '';
						var html_thumb = '';

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].html_price)!='undefined') {
								html_price = p3d.analyse_queue[file.id].html_price;
							}
							if (typeof(p3d.analyse_queue[file.id].html_status)!='undefined') {
								html_status = p3d.analyse_queue[file.id].html_status;
							}
							if (typeof(p3d.analyse_queue[file.id].html_stats)!='undefined') {
								html_stats = p3d.analyse_queue[file.id].html_stats;
								stats_style = 'visibility:visible;';
							}
							if (typeof(p3d.analyse_queue[file.id].thumbnail_url)!='undefined') {
								html_thumb = '<a target="_blank" href="'+p3d.analyse_queue[file.id].thumbnail_url+'"><img class="plupload_model_image" src="'+p3d.analyse_queue[file.id].thumbnail_url+'"></a>';
							}

								
						}
						fileList.append(
							'<li class="p3d-filelist-item" id="' + file.id + '">' +
								'<div class="plupload_file_name"><span class="plupload_file_model_name">' + file.name + '&nbsp;<a class="plupload_info_icon" onclick="jQuery(\'.plupload-overlay\').show();" href="#plupload-popup-'+file.id+'" class="plupload-button" style="'+stats_style+'"></a></span><span class="plupload_file_image">'+html_thumb+'</span></div>' +
                                                                '<div class="plupload_file_price">' + html_price + '</div>' +
                                                                '<div class="plupload_file_action"><a class="p3d-file-action" href="#"></a></div>' +
                                                                '<div class="plupload_file_meta">' +
                                                                        '<div class="plupload_file_status">' + html_status + '</div>' +
                                                                        '<div class="plupload_file_size">' + plupload.formatSize(file.size) + '</div>' +
                                                                '</div>' +
								'<div class="plupload_clearer">&nbsp;</div>' +
								attributes +
								inputHTML +
							'</li>'+
							'<div id="plupload-popup-'+file.id+'" class="plupload-overlay">'+
								'<div class="plupload-popup">'+
									'<h2>Stats</h2>'+
									'<a class="plupload-close" onclick="jQuery(\'.plupload-overlay\').hide();" href="#p3d-bulk-uploader">&times;</a>'+
									'<div class="plupload-content">'+
									html_stats+
									'</div>'+
								'</div>'+
							'</div>'
						);

						window.wp.event_manager.doAction( '3dprint.fileList_appended');

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].material_id)!='undefined') {
								//console.log('selecting existing material ', p3d.analyse_queue[file.id].material_id);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_filament]').val(p3d.analyse_queue[file.id].material_id);
							}
						}
						if (p3d.selection_order=='materials_printers') {
							p3dSelectFilamentBulk(jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_filament]'));
						}
						else if (p3d.selection_order=='printers_materials') {
							p3dSelectPrinterBulk(jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_printer]'));
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].printer_id)!='undefined') {
								console.log('selecting existing printer ', p3d.analyse_queue[file.id].printer_id);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_printer]').val(p3d.analyse_queue[file.id].printer_id);
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].coating_id)!='undefined') {
								console.log('selecting existing coating ', p3d.analyse_queue[file.id].coating_id);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_coating]').val(p3d.analyse_queue[file.id].coating_id);
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].infill)!='undefined') {
								console.log('selecting existing infill ', p3d.analyse_queue[file.id].infill);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_infill]').val(p3d.analyse_queue[file.id].infill);
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].postprocessing_id)!='undefined') {
								console.log('selecting existing postprocessing ', p3d.analyse_queue[file.id].postprocessing_id);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_postprocessing]').val(p3d.analyse_queue[file.id].postprocessing_id);
							}
							else {
								if (typeof(p3d.default_postprocessing)!='undefined' && p3d.default_postprocessing.length) {
									jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_postprocessing]').val(p3d.default_postprocessing);
								}
							}
						}


						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].unit)!='undefined') {
								console.log('selecting existing unit ', p3d.analyse_queue[file.id].unit);
								jQuery(fileList).find('.p3d-stats-bulk').last().find('select[name=product_unit]').val(p3d.analyse_queue[file.id].unit);
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].qty)!='undefined') {
								console.log('selecting existing qty ', p3d.analyse_queue[file.id].qty);	
								jQuery(fileList).find('li#'+file.id).find('input[name='+file.id+'_qty]').val(parseInt(p3d.analyse_queue[file.id].qty));
							}
						}
						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].comments)!='undefined') {
								console.log('setting existing comments ', p3d.analyse_queue[file.id].comments);	
								jQuery(fileList).find('li#'+file.id).find('textarea.p3d-bulk-comments').val(p3d.analyse_queue[file.id].comments);
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].cutting_instructions)!='undefined') {
								jQuery(fileList).find('li#'+file.id).find('select[name^=p3d_cutting_instructions]').each(function(i, obj){
//									console.log(obj);
									var cutting_instructions = p3d.analyse_queue[file.id].cutting_instructions.split(',');
									var start = jQuery(obj).prop('name').indexOf('[')+2;
									var end = jQuery(obj).prop('name').indexOf(']')-1;
									var obj_color = jQuery(obj).prop('name').substring(start, end);
									jQuery.each(cutting_instructions, function (key, value){
										if (value.length) {
											var color_instruction = value.split('=');
											var color = color_instruction[0];
											var instruction = color_instruction[1];
											if (color == obj_color) {
												jQuery(obj).val(instruction);
												console.log('setting existing cutting instruction ', color+'='+instruction);
											}
										}
									})
									//p3d.analyse_queue[file.id].cutting_instructions
								})
							}
						}

						if (typeof(p3d.analyse_queue[file.id])!='undefined') {
							if (typeof(p3d.analyse_queue[file.id].custom_attributes)!='undefined') {
								jQuery(fileList).find('li#'+file.id).find('select[name^=attribute_pa]').each(function(i, obj) {
									var attribute_name = jQuery(obj).data('id');
									var attribute_value = jQuery(obj).val();
									var custom_attributes = p3d.analyse_queue[file.id].custom_attributes;
//console.log(custom_attributes);
//										console.log(custom_attributes.length);
									for (const key in custom_attributes) {
										if (key==attribute_name)  {
											console.log('setting existing custom attribute ', custom_attributes[key]);
											jQuery(obj).val(custom_attributes[key]);
										}
									}


/*									jQuery.each(custom_attributes, function (key, value) {
										console.log("?????");
										console.log(key, attribute_name);
										if (key==attribute_name)  {
											jQuery(obj).val(value);
											console.log('setting existing custom attributes ', key, value);
										}
									});
*/
								});
							}
						}


						if (file.status == plupload.DONE) {
							jQuery(fileList).find('li#'+file.id).find('select').prop('disabled', false);
						}



						handleStatus(file);
//						if ()
//						p3dSelectFilamentBulk(jQuery('input[name=product_filament]').first().data('id') || jQuery('select[name=product_filament]').val());

						$('#' + file.id + '.plupload_delete').find('.plupload_file_action a.p3d-file-action').click(function(e) {
							$('#' + file.id).remove();
							uploader.removeFile(file);

							e.preventDefault();
						});
					});

                                        $('span.plupload_total_file_size', target).html(plupload.formatSize(uploader.total.size));
                                        if (dropzone.length) {
                                                dropzone.toggleClass('motqn-uploader__dropzone--has-files', uploader.files.length > 0);
                                        }

                                        if (filesSection.length) {
                                                filesSection.toggleClass('motqn-uploader__files-section--empty', uploader.files.length === 0);
                                        }

					if (uploader.total.queued === 0) {
						$('span.plupload_add_text', target).html(_('Add Files'));
					} else {
						$('span.plupload_add_text', target).html(o.sprintf(_('%d files queued'), uploader.total.queued));
					}

					$('a.plupload_start', target).toggleClass('plupload_disabled', uploader.files.length == (uploader.total.uploaded + uploader.total.failed));

					// Scroll to end of file list
					fileList[0].scrollTop = fileList[0].scrollHeight;

					updateTotalProgress();

					// Re-add drag message if there is no files
					if (!uploader.files.length && uploader.features.dragdrop && uploader.settings.dragdrop) {
						$('#' + id + '_filelist').append('<li class="plupload_droptext">' + _("Drag files here.") + '</li>');
					}
				}
				function addToAnalyseQueue (file) {
					analyse_queue[file.id] = file;
//					console.log(analyse_queue);
				}

				function destroy() {
					delete uploaders[id];
					uploader.destroy();
					target.html(contents_bak);
					uploader = target = contents_bak = null;
				}

				uploader.bind("UploadFile", function(up, file) {
					$('#' + file.id).addClass('plupload_current_file');
				});

				uploader.bind('Init', function(up, res) {
					// Enable rename support
					if (!settings.unique_names && settings.rename) {
						target.on('click', '#' + id + '_filelist div.plupload_file_name span', function(e) {
							var targetSpan = $(e.target), file, parts, name, ext = "";

							// Get file name and split out name and extension
							file = up.getFile(targetSpan.parents('li')[0].id);
							name = file.name;
							parts = /^(.+)(\.[^.]+)$/.exec(name);
							if (parts) {
								name = parts[1];
								ext = parts[2];
							}

							// Display input element
							targetSpan.hide().after('<input type="text" />');
							targetSpan.next().val(name).focus().blur(function() {
								targetSpan.show().next().remove();
							}).keydown(function(e) {
								var targetInput = $(this);

								if (e.keyCode == 13) {
									e.preventDefault();

									// Rename file and glue extension back on
									file.name = targetInput.val() + ext;
									targetSpan.html(file.name);
									targetInput.blur();
								}
							});
						});
					}

					//$('#' + id + '_container').attr('title', 'Using runtime: ' + res.runtime);

					$('a.plupload_start', target).click(function(e) {
						if (!$(this).hasClass('plupload_disabled')) {
							uploader.start();
						}

						e.preventDefault();
					});

					$('a.plupload_stop', target).click(function(e) {
						e.preventDefault();
						uploader.stop();
					});

					$('a.plupload_start', target).addClass('plupload_disabled');
				});

				uploader.bind("Error", function(up, err) {
					var file = err.file, message;

					if (file) {
						message = err.message;

						if (err.details) {
							message += " (" + err.details + ")";
						}

						if (err.code == plupload.FILE_SIZE_ERROR) {
							alert(_("Error: File too large:") + " " + file.name);
						}

						if (err.code == plupload.FILE_EXTENSION_ERROR) {
							alert(_("Error: Invalid file extension:") + " " + file.name);
						}
						
						file.hint = message;
						$('#' + file.id).attr('class', 'plupload_failed').find('a').css('display', 'inline-block').attr('title', message);
					}

					if (err.code === plupload.INIT_ERROR) {
						setTimeout(function() {
							destroy();
						}, 1);
					}
				});

				uploader.bind("PostInit", function(up) {
					// features are populated only after input components are fully instantiated
					if (up.settings.dragdrop && up.features.dragdrop) {
						$('#' + id + '_filelist').append('<li class="plupload_droptext">' + _("Drag files here.") + '</li>');
					}
				});

				uploader.init();

				uploader.bind('StateChanged', function() {
                                        if (uploader.state === plupload.STARTED) {
                                                $('li.plupload_delete a,div.plupload_buttons', target).hide();
                                                uploader.disableBrowse(true);

                                                $('span.plupload_upload_status,a.plupload_stop', target).css('display', 'inline-block');
                                                $('div.plupload_progress', target).css('display', 'block');
						$('span.plupload_upload_status', target).html('Uploaded ' + uploader.total.uploaded + '/' + uploader.files.length + ' files');

						if (settings.multiple_queues) {
							$('span.plupload_total_status,span.plupload_total_file_size', target).show();
						}
					} else {
						updateList();
						$('a.plupload_stop,div.plupload_progress', target).hide();
						$('a.plupload_delete', target).css('display', 'inline-block');

						if (settings.multiple_queues && uploader.total.uploaded + uploader.total.failed == uploader.files.length) {
							$(".plupload_buttons,.plupload_upload_status", target).css("display", "inline");
							uploader.disableBrowse(false);

							$(".plupload_start", target).addClass("plupload_disabled");
							$('span.plupload_total_status,span.plupload_total_file_size', target).hide();
						}
					}
				});

				uploader.bind('FilesAdded', updateList);

				uploader.bind('FilesRemoved', function() {
					// since the whole file list is redrawn for every change in the queue
					// we need to scroll back to the file removal point to avoid annoying
					// scrolling to the bottom bug (see #926)
					var scrollTop = $('#' + id + '_filelist').scrollTop();
					updateList();
					$('#' + id + '_filelist').scrollTop(scrollTop);
				});

/*				uploader.bind('FileUploaded', function(up, file, response) {
					//file.price = 123; //take from response
					addToAnalyseQueue(file);
					handleStatus(file);
				});
*/

				uploader.bind("UploadProgress", function(up, file) {
					// Set file specific progress
					if (file.percent==100 && file.status!=5) {
						file.percent = 99;
					}
					$('#' + file.id + ' div.plupload_file_status', target).html('Uploading '+file.percent + '%'); //todo text_uploading
//					$('#' + file.id + ' div.plupload_file_price', target).html(file.percent + '%'); //todo ajax image

					handleStatus(file);
					updateTotalProgress();
				});

				// Call setup function
				if (settings.setup) {
					settings.setup(uploader);
				}
			});

			return this;
		} else {
			// Get uploader instance for specified element
			return uploaders[$(this[0]).attr('id')];
		}
	};
})(jQuery, mOxie);