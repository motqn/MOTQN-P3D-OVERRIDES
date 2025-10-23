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
                                                        '<div class="motqn-uploader__header">' +
                                                                '<div class="motqn-uploader__intro">' +
                                                                        '<h2 class="motqn-uploader__title">' + _('Upload 3D Files') + '</h2>' +
                                                                        '<p class="motqn-uploader__subtitle">' + p3d.text_bulk_plupload_header_text + '</p>' +
                                                                '</div>' +
                                                                '<div class="motqn-uploader__buttons">' +
                                                                        '<div class="plupload_buttons">' +
                                                                                '<a href="#" class="plupload_button plupload_add motqn-button motqn-button--primary" id="' + id + '_browse">' + _('Add 3D Files') + '</a>' +
                                                                                '<a href="#" style="display:none;" class="plupload_button plupload_start motqn-button motqn-button--ghost">' + _('Start Upload') + '</a>' +
                                                                        '</div>' +
                                                                        '<span class="plupload_upload_status"></span>' +
                                                                '</div>' +
                                                        '</div>' +
                                                        '<div class="plupload_progress motqn-progress">' +
                                                                '<div class="plupload_progress_container">' +
                                                                        '<div class="plupload_progress_bar"></div>' +
                                                                '</div>' +
                                                        '</div>' +
                                                        '<div class="motqn-uploader__dropzone" id="' + id + '_dropzone">' +
                                                                '<div class="motqn-uploader__dropzone-message">' + _('Drag & drop files here or use the button above.') + '</div>' +
                                                                '<ul id="' + id + '_filelist" class="plupload_filelist motqn-card-list"></ul>' +
                                                        '</div>' +
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
                                                                        '<button type="button" class="motqn-button motqn-button--primary motqn-summary__primary">' + _('Add to Cart') + '</button>' +
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
                                                dropzone = $('#' + id + '_dropzone', target);

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
						var attributes = '<table class="p3d-stats-bulk">';

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
								'<div class="plupload_file_qty">' + '<input name="'+file.id+'_qty" type="number" min="1" step="1" value="1" onchange=p3dSelectQTYBulk(this)>' + '</div>' +
								'<div class="plupload_file_action"><a class="p3d-file-action" href="#"></a></div>' +
								'<div class="plupload_file_status">' + html_status + '</div>' +
								'<div class="plupload_file_size">' + plupload.formatSize(file.size) + '</div>' +
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

					if (uploader.total.queued === 0) {
						$('span.plupload_add_text', target).html(_('Add Files'));
					} else {
						$('span.plupload_add_text', target).html(o.sprintf(_('%d files queued'), uploader.total.queued));
					}

					$('a.plupload_start', target).toggleClass('plupload_disabled', uploader.files.length == (uploader.total.uploaded + uploader.total.failed));

                                        // Scroll to end of file list
                                        if (fileList.length) {
                                            fileList[0].scrollTop = fileList[0].scrollHeight;
                                        }

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

						$('span.plupload_upload_status,div.plupload_progress,a.plupload_stop', target).css('display', 'inline-block');
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
                                                        '<div class="motqn-uploader__header">' +
                                                                '<div class="motqn-uploader__intro">' +
                                                                        '<h2 class="motqn-uploader__title">' + _('Upload 3D Files') + '</h2>' +
                                                                        '<p class="motqn-uploader__subtitle">' + p3d.text_bulk_plupload_header_text + '</p>' +
                                                                '</div>' +
                                                                '<div class="motqn-uploader__buttons">' +
                                                                        '<div class="plupload_buttons">' +
                                                                                '<a href="#" class="plupload_button plupload_add motqn-button motqn-button--primary" id="' + id + '_browse">' + _('Add 3D Files') + '</a>' +
                                                                                '<a href="#" style="display:none;" class="plupload_button plupload_start motqn-button motqn-button--ghost">' + _('Start Upload') + '</a>' +
                                                                        '</div>' +
                                                                        '<span class="plupload_upload_status"></span>' +
                                                                '</div>' +
                                                        '</div>' +
                                                        '<div class="plupload_progress motqn-progress">' +
                                                                '<div class="plupload_progress_container">' +
                                                                        '<div class="plupload_progress_bar"></div>' +
                                                                '</div>' +
                                                        '</div>' +
                                                        '<div class="motqn-uploader__dropzone" id="' + id + '_dropzone">' +
                                                                '<div class="motqn-uploader__dropzone-message">' + _('Drag & drop files here or use the button above.') + '</div>' +
                                                                '<ul id="' + id + '_filelist" class="plupload_filelist motqn-card-list"></ul>' +
                                                        '</div>' +
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
                                                                        '<button type="button" class="motqn-button motqn-button--primary motqn-summary__primary">' + _('Add to Cart') + '</button>' +
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
                                            dropzone = $('#' + id + '_dropzone', target);

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
						var attributes = '<table class="p3d-stats-bulk">';

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
								'<div class="plupload_file_qty">' + '<input name="'+file.id+'_qty" type="number" min="1" step="1" value="1" onchange=p3dSelectQTYBulk(this)>' + '</div>' +
								'<div class="plupload_file_action"><a class="p3d-file-action" href="#"></a></div>' +
								'<div class="plupload_file_status">' + html_status + '</div>' +
								'<div class="plupload_file_size">' + plupload.formatSize(file.size) + '</div>' +
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

					if (uploader.total.queued === 0) {
						$('span.plupload_add_text', target).html(_('Add Files'));
					} else {
						$('span.plupload_add_text', target).html(o.sprintf(_('%d files queued'), uploader.total.queued));
					}

					$('a.plupload_start', target).toggleClass('plupload_disabled', uploader.files.length == (uploader.total.uploaded + uploader.total.failed));

                                        // Scroll to end of file list
                                        if (fileList.length) {
                                            fileList[0].scrollTop = fileList[0].scrollHeight;
                                        }

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

						$('span.plupload_upload_status,div.plupload_progress,a.plupload_stop', target).css('display', 'inline-block');
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
;(function($) {
    'use strict';

    var MOTQN = {
        init: function() {
            var self = this;
            $(function() {
                self.$uploaders = $('.motqn-uploader');
                self.$uploaders.each(function() {
                    self.setupUploader($(this));
                });
                self.bindGlobalEvents();
            });
        },

        bindGlobalEvents: function() {
            if (this._eventsBound) {
                return;
            }
            this._eventsBound = true;
            var self = this;

            if (window.wp && window.wp.event_manager && typeof window.wp.event_manager.addAction === 'function') {
                window.wp.event_manager.addAction('3dprint.fileList_appended', function() {
                    $('.motqn-uploader').each(function() {
                        self.ensureWorkspace($(this));
                        self.refreshUploader($(this));
                    });
                });
            }

            $(document).on('click', '.motqn-card-list .p3d-file-action', function() {
                var $uploader = $(this).closest('.motqn-uploader');
                setTimeout(function() {
                    self.refreshUploader($uploader);
                }, 80);
            });

            $(document).on('input change', '.motqn-card-list .plupload_file_qty input', function() {
                var $input = $(this);
                var $card = $input.closest('.p3d-filelist-item');
                self.ensureQuantityValue($input);
                self.updateCardPrice($card);
                self.updateSummary($card.closest('.motqn-uploader'));
            });
        },

        setupUploader: function($uploader) {
            if (!$uploader.length || $uploader.data('motqnPrepared')) {
                return;
            }
            $uploader.data('motqnPrepared', true).addClass('motqn-uploader--enhanced');
            this.ensureWorkspace($uploader);
            this.attachListObserver($uploader);
            this.refreshUploader($uploader);
        },

        ensureWorkspace: function($uploader) {
            var $main = $uploader.find('.motqn-uploader__main');
            if (!$main.length) {
                return;
            }

            var $dropzone = $main.find('.motqn-uploader__dropzone');
            if (!$dropzone.length) {
                return;
            }

            var $fileList = $uploader.find('.motqn-card-list').first();
            var $workspace = $main.find('.motqn-uploader__workspace');

            if (!$workspace.length) {
                $workspace = $('<div class="motqn-uploader__workspace"></div>');
                var $dropWrapper = $('<div class="motqn-uploader__dropzone-wrapper"></div>');
                var $queue = $('<div class="motqn-uploader__queue"></div>');

                $workspace.append($dropWrapper).append($queue);

                if ($dropzone.parent().length) {
                    $dropzone.replaceWith($workspace);
                } else {
                    $main.prepend($workspace);
                }

                $dropWrapper.append($dropzone);

                if ($fileList.length) {
                    $queue.append($fileList);
                }
            } else {
                var $dropWrapperExisting = $workspace.find('.motqn-uploader__dropzone-wrapper');
                if (!$dropWrapperExisting.length) {
                    $dropWrapperExisting = $('<div class="motqn-uploader__dropzone-wrapper"></div>').prependTo($workspace);
                }
                if (!$dropWrapperExisting.is($dropzone.parent())) {
                    $dropWrapperExisting.prepend($dropzone);
                }

                var $queueExisting = $workspace.find('.motqn-uploader__queue');
                if (!$queueExisting.length) {
                    $queueExisting = $('<div class="motqn-uploader__queue"></div>').appendTo($workspace);
                }
                if ($fileList.length && !$queueExisting.is($fileList.parent())) {
                    $queueExisting.append($fileList);
                }
            }

            var $summary = $main.find('.motqn-summary');
            if ($summary.length) {
                $summary.addClass('motqn-summary--footer');
                if (!$summary.parent().is($main)) {
                    $summary.appendTo($main);
                } else {
                    $summary.appendTo($main);
                }
            }
        },

        attachListObserver: function($uploader) {
            var $list = $uploader.find('.motqn-card-list');
            if (!$list.length || $list.data('motqnListObserver')) {
                return;
            }
            var self = this;
            var observer = new MutationObserver(function() {
                self.refreshUploader($uploader);
            });
            observer.observe($list[0], { childList: true });
            $list.data('motqnListObserver', observer);
        },

        refreshUploader: function($uploader) {
            if (!$uploader.length || $uploader.data('motqnRefreshing')) {
                return;
            }
            $uploader.data('motqnRefreshing', true);
            var self = this;
            $uploader.find('.motqn-card-list > li.p3d-filelist-item').each(function() {
                self.enhanceCard($(this));
            });
            self.updateSummary($uploader);
            $uploader.data('motqnRefreshing', false);
        },

        enhanceCard: function($card) {
            if (!$card.length) {
                return;
            }
            $card.addClass('motqn-file-card');

            var $container = $card.children('.motqn-file-card__container');
            if (!$container.length) {
                $container = $('<div class="motqn-file-card__container"></div>');
                $container.append($card.contents());
                $card.append($container);
            }

            var $name = $container.find('.plupload_file_name');
            var $price = $container.find('.plupload_file_price');
            var $qty = $container.find('.plupload_file_qty');
            var $action = $container.find('.plupload_file_action');
            var $status = $container.find('.plupload_file_status');
            var $size = $container.find('.plupload_file_size');

            var $header = $container.children('.motqn-file-card__header');
            if (!$header.length) {
                $header = $('<div class="motqn-file-card__header"></div>');
                var $meta = $('<div class="motqn-file-card__meta"></div>');
                var $controls = $('<div class="motqn-file-card__controls"></div>');
                $meta.append($name);
                $controls.append($price).append($qty).append($action);
                $header.append($meta).append($controls);
                $container.prepend($header);
            } else {
                $header.find('.motqn-file-card__meta').append($name);
                $header.find('.motqn-file-card__controls').append($price).append($qty).append($action);
            }

            $name.find('.plupload_info_icon').remove();

            var $imageWrapper = $name.find('.plupload_file_image').detach();
            var $media = $container.children('.motqn-file-card__media');
            if (!$media.length) {
                $media = $('<div class="motqn-file-card__media"></div>');
                $header.after($media);
            }

            var $visual = $media.children('.motqn-file-card__visual');
            if (!$visual.length) {
                $visual = $('<div class="motqn-file-card__visual"></div>');
                $media.prepend($visual);
            }

            var $preview = $media.find('> .motqn-file-card__preview');
            if ($preview.length && !$preview.parent().hasClass('motqn-file-card__visual')) {
                $preview.appendTo($visual);
            }
            if (!$preview.length) {
                $preview = $('<div class="motqn-file-card__preview"></div>').appendTo($visual);
            }

            if ($imageWrapper && $imageWrapper.length && $imageWrapper.html().trim().length) {
                $preview.empty().append($imageWrapper);
            } else if (!$preview.children().length) {
                $preview.html('<div class="motqn-file-card__no-preview">' + this.translate('Preview not available') + '</div>');
            }

            var statsHtml = this.extractStatsForCard($card.attr('id'));
            var $stats = $media.children('.motqn-file-card__stats');
            if (!$stats.length) {
                $stats = $('<div class="motqn-file-card__stats"></div>').appendTo($media);
            }
            if (statsHtml) {
                $stats.html(statsHtml).addClass('motqn-file-card__stats--visible');
            } else if (!$stats.children().length) {
                $stats.html('<p class="motqn-file-card__stats-placeholder">' + this.translate('Model details will appear here after analysis.') + '</p>');
            }

            $container.children('.motqn-file-card__status').remove();
            var $progress = $visual.children('.motqn-file-card__status');
            if (!$progress.length) {
                $progress = $('<div class="motqn-file-card__status"></div>').appendTo($visual);
            }
            if ($status.length) {
                $progress.append($status);
            }
            if ($size.length) {
                $progress.append($size);
            }

            $container.find('.plupload_clearer').remove();

            var $config = $container.children('.motqn-file-card__config');
            if (!$config.length) {
                $config = $('<div class="motqn-file-card__config"></div>');
                $container.append($config);
            }
            $container.find('table.p3d-stats-bulk').appendTo($config);

            this.enhanceMaterialSelectors($config);
            this.attachPriceObserver($card);
            this.updateCardPrice($card);
        },

        extractStatsForCard: function(id) {
            if (!id) {
                return '';
            }
            var $overlay = $('#plupload-popup-' + id);
            if (!$overlay.length) {
                return '';
            }
            var html = $overlay.find('.plupload-content').html();
            $overlay.remove();
            return html;
        },

        ensureQuantityValue: function($input) {
            var value = parseInt($input.val(), 10);
            if (!value || value < 1) {
                value = 1;
            }
            $input.val(value);
            return value;
        },

        getQuantity: function($card) {
            var $input = $card.find('.plupload_file_qty input');
            if (!$input.length) {
                return 1;
            }
            return this.ensureQuantityValue($input);
        },

        attachPriceObserver: function($card) {
            var $price = $card.find('.plupload_file_price');
            if (!$price.length || $price.data('motqnPriceObserver')) {
                return;
            }
            var self = this;
            var observer = new MutationObserver(function() {
                if ($price.data('motqnUpdating')) {
                    return;
                }
                $price.removeData('motqnRawPrice');
                self.updateCardPrice($card);
                self.updateSummary($card.closest('.motqn-uploader'));
            });
            observer.observe($price[0], { childList: true, subtree: true });
            $price.data('motqnPriceObserver', observer);
        },

        updateCardPrice: function($card) {
            var $price = $card.find('.plupload_file_price');
            if (!$price.length) {
                return;
            }

            var raw = $price.data('motqnRawPrice');
            if (!raw) {
                if ($price.find('.motqn-price').length) {
                    raw = $price.data('motqnRawHtml');
                } else {
                    raw = $price.html();
                }
            }
            if (!raw) {
                return;
            }

            $price.data('motqnRawPrice', raw);
            $price.data('motqnUpdating', true);

            var qty = this.getQuantity($card);
            var meta = this.parsePrice(raw);
            var totalText = meta ? this.formatPrice(meta, meta.value * qty) : raw;

            var markup = '<div class="motqn-price"' + (meta ? ' data-motqn-price="true"' : '') + '>' +
                '<div class="motqn-price__row motqn-price__row--unit">' +
                    '<span class="motqn-price__label">' + this.translate('Unit Price') + '</span>' +
                    '<span class="motqn-price__value motqn-price__value--unit">' + raw + '</span>' +
                '</div>' +
                '<div class="motqn-price__row motqn-price__row--total">' +
                    '<span class="motqn-price__label">' + this.translate('Total') + '</span>' +
                    '<span class="motqn-price__value motqn-price__value--total">' + totalText + '</span>' +
                '</div>' +
            '</div>';

            $price.html(markup);
            if (meta) {
                $price.data('motqnPriceMeta', meta);
            } else {
                $price.removeData('motqnPriceMeta');
            }
            $price.data('motqnUpdating', false);
            $price.data('motqnRawHtml', raw);
        },

        parsePrice: function(html) {
            if (!html) {
                return null;
            }
            var text = $('<div>').html(html).text().trim();
            if (!text) {
                return null;
            }
            var match = text.match(/-?\d[\d.,]*/);
            if (!match) {
                return null;
            }

            var numberPart = match[0];
            var prefix = text.slice(0, match.index);
            var suffix = text.slice(match.index + numberPart.length);
            var hasComma = numberPart.indexOf(',') !== -1;
            var hasDot = numberPart.indexOf('.') !== -1;
            var decimalSeparator = null;
            var thousandSeparator = null;

            if (hasComma && hasDot) {
                if (numberPart.lastIndexOf('.') > numberPart.lastIndexOf(',')) {
                    decimalSeparator = '.';
                    thousandSeparator = ',';
                } else {
                    decimalSeparator = ',';
                    thousandSeparator = '.';
                }
            } else if (hasComma) {
                decimalSeparator = ',';
            } else if (hasDot) {
                decimalSeparator = '.';
            } else {
                decimalSeparator = '.';
            }

            var normalized = numberPart;
            if (thousandSeparator) {
                var reg = new RegExp('\\' + thousandSeparator, 'g');
                normalized = normalized.replace(reg, '');
            }
            normalized = normalized.replace(/[^0-9,.-]/g, '');
            if (decimalSeparator === ',') {
                normalized = normalized.replace(',', '.');
            }
            var value = parseFloat(normalized);
            if (!isFinite(value)) {
                return null;
            }

            var decimals = 0;
            if (decimalSeparator) {
                var last = numberPart.lastIndexOf(decimalSeparator);
                if (last !== -1) {
                    decimals = numberPart.length - last - 1;
                }
            }

            var locale = decimalSeparator === ',' ? 'de-DE' : 'en-US';

            return {
                value: value,
                prefix: prefix,
                suffix: suffix,
                decimals: decimals,
                locale: locale,
                decimalSeparator: decimalSeparator
            };
        },

        formatPrice: function(meta, value) {
            if (!meta) {
                return value;
            }
            var options = {
                minimumFractionDigits: meta.decimals,
                maximumFractionDigits: meta.decimals
            };
            var formatted;
            try {
                formatted = new Intl.NumberFormat(meta.locale || undefined, options).format(value);
            } catch (e) {
                formatted = value.toFixed(meta.decimals);
            }
            if (meta.decimalSeparator === ',' && formatted.indexOf(',') === -1 && formatted.indexOf('.') !== -1) {
                formatted = formatted.replace('.', ',');
            }
            return (meta.prefix || '') + formatted + (meta.suffix || '');
        },

        updateSummary: function($uploader) {
            if (!$uploader.length) {
                return;
            }
            var total = 0;
            var metaRef = null;
            var self = this;

            $uploader.find('.motqn-card-list > li.p3d-filelist-item').each(function() {
                var $price = $(this).find('.plupload_file_price');
                var meta = $price.data('motqnPriceMeta');
                if (!meta) {
                    return;
                }
                if (!metaRef) {
                    metaRef = $.extend({}, meta);
                }
                var qty = self.getQuantity($(this));
                total += meta.value * qty;
            });

            var $summary = $uploader.find('.plupload_total_price');
            if (!$summary.length) {
                return;
            }

            if (metaRef) {
                $summary.text(this.formatPrice(metaRef, total));
            } else if ($uploader.find('.p3d-filelist-item').length) {
                $summary.text(this.translate('Calculating…'));
            } else {
                $summary.text('0');
            }
        },

        enhanceMaterialSelectors: function($context) {
            var self = this;
            $context.find('select[name="product_filament"]').each(function() {
                var $select = $(this);
                if ($select.hasClass('motqn-material--enhanced')) {
                    return;
                }
                var materials = self.collectMaterialOptions($select);
                if (!materials.groups.length) {
                    return;
                }
                $select.addClass('motqn-material--enhanced').hide();
                var $picker = self.renderMaterialPicker(materials, $select);
                $select.after($picker);
                self.syncMaterialPicker($picker, $select, materials);
            });
        },

        collectMaterialOptions: function($select) {
            var groups = {};
            var ordered = [];
            var optionsByValue = {};
            var self = this;

            $select.find('option').each(function(index) {
                var $option = $(this);
                var value = $option.attr('value');
                if (!value) {
                    return;
                }
                var data = self.materialDataFromOption($option, index);
                var key = data.groupKey;
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        label: data.groupLabel,
                        options: []
                    };
                    ordered.push(groups[key]);
                }
                var optionItem = {
                    value: value,
                    label: data.label,
                    color: data.color,
                    image: data.image,
                    groupKey: key
                };
                groups[key].options.push(optionItem);
                optionsByValue[value] = $.extend({}, optionItem);
            });

            return {
                groups: ordered,
                optionsByValue: optionsByValue
            };
        },

        materialDataFromOption: function($option, index) {
            var label = $.trim($option.text());
            var group = $option.data('group') || $option.attr('data-group') || '';
            var color = $option.data('color') || $option.attr('data-color') || '';
            var image = $option.data('image') || $option.attr('data-image') || $option.data('preview') || $option.attr('data-preview') || '';
            var groupLabel = group;
            var colorLabel = color;

            if ((!groupLabel || !colorLabel) && label.indexOf('-') !== -1) {
                var parts = label.split('-');
                if (!groupLabel) {
                    groupLabel = $.trim(parts[0]);
                }
                if (!colorLabel) {
                    colorLabel = $.trim(parts.slice(1).join('-')) || label;
                }
            }

            if (!groupLabel) {
                groupLabel = label || this.translate('Material');
            }
            if (!colorLabel) {
                colorLabel = label || this.translate('Color');
            }

            var key = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (!key) {
                key = 'group-' + index;
            }

            return {
                groupKey: key,
                groupLabel: groupLabel,
                label: colorLabel,
                color: color,
                image: image
            };
        },

        renderMaterialPicker: function(materials, $select) {
            var self = this;
            var $picker = $('<div class="motqn-material-picker"></div>');
            var $groupSection = $('<div class="motqn-material-picker__section"></div>');
            $groupSection.append('<span class="motqn-material-picker__title">' + this.translate('Material Group') + '</span>');
            var $groupSelect = $('<select class="motqn-material-picker__select"></select>');
            $groupSelect.append('<option value="">' + this.translate('Select a group') + '</option>');
            materials.groups.forEach(function(group) {
                $groupSelect.append('<option value="' + group.key + '">' + group.label + '</option>');
            });
            $groupSection.append($groupSelect);
            $picker.append($groupSection);

            var $colorSection = $('<div class="motqn-material-picker__section"></div>');
            $colorSection.append('<span class="motqn-material-picker__title">' + this.translate('Color') + '</span>');
            var $colorList = $('<div class="motqn-material-picker__colors"></div>');
            $colorSection.append($colorList);
            $picker.append($colorSection);

            $picker.data('motqnMaterials', materials);
            $picker.data('motqnHiddenSelect', $select);
            $picker.data('motqnGroupSelect', $groupSelect);
            $picker.data('motqnColorList', $colorList);

            $groupSelect.on('change', function() {
                self.renderColorOptions($picker, this.value);
            });

            $colorList.on('click', '.motqn-material-picker__color', function() {
                var value = $(this).data('value');
                self.selectMaterialValue($picker, value, true);
            });

            return $picker;
        },

        renderColorOptions: function($picker, groupKey) {
            var materials = $picker.data('motqnMaterials');
            var $colorList = $picker.data('motqnColorList');
            var $select = $picker.data('motqnHiddenSelect');
            var currentValue = $select.val();

            $colorList.empty();

            var group = null;
            materials.groups.forEach(function(item) {
                if (item.key === groupKey) {
                    group = item;
                }
            });

            if (!group) {
                $colorList.append('<p class="motqn-material-picker__empty">' + this.translate('Select a material group to view colors.') + '</p>');
                return;
            }

            group.options.forEach(function(option) {
                var $button = $('<button type="button" class="motqn-material-picker__color"></button>');
                $button.attr('data-value', option.value);
                $button.append('<span class="motqn-material-picker__color-chip"></span>');
                $button.append('<span class="motqn-material-picker__color-label">' + option.label + '</span>');
                if (option.color) {
                    $button[0].style.setProperty('--motqn-chip-color', option.color);
                }
                if (option.image) {
                    $button.addClass('motqn-material-picker__color--has-preview');
                    $button[0].style.setProperty('--motqn-color-preview', 'url("' + option.image + '")');
                }
                if (option.value === currentValue) {
                    $button.addClass('is-active');
                }
                $colorList.append($button);
            });

            if (!group.options.length) {
                $colorList.append('<p class="motqn-material-picker__empty">' + this.translate('No colors available for this group.') + '</p>');
            }
        },

        selectMaterialValue: function($picker, value, trigger) {
            var $select = $picker.data('motqnHiddenSelect');
            if (!$select || !value) {
                return;
            }
            $select.val(value);
            if (trigger) {
                $select.trigger('change');
            }
            var materials = $picker.data('motqnMaterials');
            var option = materials.optionsByValue[value];
            if (option) {
                var $groupSelect = $picker.data('motqnGroupSelect');
                if ($groupSelect.val() !== option.groupKey) {
                    $groupSelect.val(option.groupKey);
                    this.renderColorOptions($picker, option.groupKey);
                }
                var $colorList = $picker.data('motqnColorList');
                $colorList.find('.motqn-material-picker__color').removeClass('is-active');
                $colorList.find('.motqn-material-picker__color[data-value="' + value + '"]').addClass('is-active');
            }
        },

        syncMaterialPicker: function($picker, $select, materials) {
            var self = this;
            $select.on('change.motqn', function() {
                var value = $(this).val();
                var option = materials.optionsByValue[value];
                var $groupSelect = $picker.data('motqnGroupSelect');
                if (option) {
                    if ($groupSelect.val() !== option.groupKey) {
                        $groupSelect.val(option.groupKey);
                        self.renderColorOptions($picker, option.groupKey);
                    }
                    var $colorList = $picker.data('motqnColorList');
                    $colorList.find('.motqn-material-picker__color').removeClass('is-active');
                    $colorList.find('.motqn-material-picker__color[data-value="' + value + '"]').addClass('is-active');
                } else {
                    $groupSelect.val('');
                    self.renderColorOptions($picker, '');
                }
            });

            var initial = $select.val();
            if (initial) {
                this.selectMaterialValue($picker, initial, false);
            } else if (materials.groups.length) {
                var firstGroup = materials.groups[0];
                $picker.data('motqnGroupSelect').val(firstGroup.key);
                this.renderColorOptions($picker, firstGroup.key);
            } else {
                this.renderColorOptions($picker, '');
            }
        },

        translate: function(text) {
            if (window.plupload && typeof window.plupload.translate === 'function') {
                return window.plupload.translate(text) || text;
            }
            return text;
        }
    };

    MOTQN.init();

})(jQuery);
