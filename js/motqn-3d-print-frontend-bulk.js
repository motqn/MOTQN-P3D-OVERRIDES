/**
 * @author Sergey Burkov, http://www.wp3dprinting.com
 * @copyright 2020
 */

p3d.analyse_queue = [];
p3d.analysing = false;
p3d.xhr3='';
p3d.xhr4='';
p3d.all_finished = false;
p3d.image_height=5;
p3d.image_map=1;


function p3dInitBulk() {
	if (p3d.tooltip_engine=='tooltipster') {
		jQuery('.p3d-tooltip').tooltipster({ contentAsHTML: true, maxWidth: 350, theme: 'tooltipster-'+p3d.tooltip_theme });
	}
	else if (p3d.tooltip_engine=='tippy') {
		jQuery('.p3d-tooltip').each(function(i,item){
			var tooltip_id = jQuery(this).data('tooltip-content');
			var template = jQuery(tooltip_id).html();
			if (typeof(template)!='undefined') {
				tippy(this, {
					content: template,
					allowHTML: true,
					maxWidth: 350,
					theme: p3d.tooltip_theme
				});
			}
		});
	}
	p3d.currency_rate = jQuery('#p3d_currency_rate').val();
}

jQuery(function() {
//	var file_extensions = p3d.file_extensions.replace('zip','').replace('dxf','');//todo 
	//var file_extensions = p3d.file_extensions.replace('zip','')//todo 
	var file_extensions = p3d.file_extensions;
	// Setup html5 version
	p3d.plupload_queue = jQuery("#p3d-bulk-uploader").pluploadQueue({
		// General settings
		runtimes : 'html5,flash,silverlight,html4',
		multi_selection: true,
		multiple_queues : true,
		url : p3d.url,
		max_file_size: p3d.file_max_size+"mb",
		chunk_size : p3d.file_chunk_size+'mb',
		rename : true,
		dragdrop: true,
		flash_swf_url : p3d.plugin_url+'includes/ext/plupload/Moxie.swf',
		silverlight_xap_url : p3d.plugin_url+'includes/ext/plupload/Moxie.xap',
		multipart_params : {
			"action" : "p3d_handle_upload",
			"upload_type" : "bulk",
		},
		filters : {
		mime_types: [
			{
				title : file_extensions+" files", 
				extensions : file_extensions 
			}
		]
		},
		init: {
			FilesRemoved:  function(p3d_uploader, files) {
				if(files.length > 0) {
					for (var i=0;i<files.length;i++) {
						var file_id = files[i].id
						if (typeof(p3d.analyse_queue[file_id])!='undefined') {
							delete p3d.analyse_queue[file_id];
						}
					}
				}
			},
			QueueChanged: function(p3d_uploader) {
				if (p3d_uploader.files.length==0) {
					jQuery('#p3d-calculate-price-button').prop('disabled', true);
					jQuery('#p3d-calculate-loader').hide();
					jQuery('#p3d-submit-button').prop('disabled', true);
				}
			},
			PostInit: function() {
				if ((navigator.platform.indexOf("iPhone") == -1) && (navigator.platform.indexOf("iPad") == -1)) {
					jQuery('#p3d-bulk-uploader input[type=file]').prop('accept', p3d.file_extensions.split(',').map(i => '.' + i).join(','));
				}
			},
		FilesAdded: function(up, files) {
			jQuery('#p3d-calculate-price-button').prop('disabled', true);
			jQuery('#p3d-calculate-loader').show();
			jQuery('#p3d-submit-button').prop('disabled', true);

			if(up.files.length > 0) {
				for (var i=0;i<up.files.length;i++) {
					var file_id = up.files[i].id
					if (typeof(p3d.analyse_queue[file_id])=='undefined') {
							
						p3d.analyse_queue[file_id] = up.files[i]
					}
				}
			}


			up.start();
		},
		BeforeUpload: function(up, file) {
			if (typeof(p3d.analyse_queue[file.id])=='undefined') {
				p3d.analyse_queue[file.id] = file;
			}

			var file_ext = file.name.split('.').pop().toLowerCase();
			var images = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];
			
			if (jQuery.inArray(file_ext, images)!=-1) {
				p3d.analyse_queue[file.id].image_height = prompt(file.name+'\n'+p3d.text_image_height, p3d.image_height);
				p3d.analyse_queue[file.id].image_map = confirm(file.name+'\n'+p3d.text_image_map) ? 1 : 0;
				up.settings.multipart_params.image_height = p3d.analyse_queue[file.id].image_height;
				up.settings.multipart_params.image_map = p3d.analyse_queue[file.id].image_map;

			}
			if (file_ext == 'obj' && p3d.server_triangulation=='on') {
				p3d.analyse_queue[file.id].triangulation_required = true; //todo detect
				p3d.analyse_queue[file.id].repair_status = 0;
			}
			else {
				p3d.analyse_queue[file.id].triangulation_required = false;
			}


		},
		FileUploaded: function(p3d_uploader,file,response) {
			var data = jQuery.parseJSON( response.response )

			file.server_name = data.filename;
			p3d.analyse_queue[file.id] = file;
			var file_ext = file.server_name.split('.').pop().toLowerCase();
			var file_id = file.id;

			if (file_ext=='dxf') {
				jQuery.ajax({
					url : p3d.upload_url+encodeURIComponent(file.server_name),
					success : function(result) {
						var parser = new window.DxfParser();
						var dxf = parser.parseSync(result);
						var colors = new Array();


						if (typeof(dxf.entities)!='undefined' && dxf.entities.length>0) {
							for (var i=0;i<dxf.entities.length;i++) {
								if(dxf.tables && dxf.tables.layer && dxf.tables.layer.layers[dxf.entities[i].layer] && dxf.entities[i].colorIndex==0) {
									var color_num = dxf.tables.layer.layers[dxf.entities[i].layer].color;
									if (color_num>256) {
										if (p3d.dxf_color_codes.indexOf(color_num)!=-1) { //non standard color format
											color_num = p3d.dxf_color_codes.indexOf(color_num);
										} 
										else {
											color_num = 7; //white
										}
									}


									colors[color_num]='#'+p3dToHex(p3d.dxf_color_codes[color_num], 6);
								}
								else if(dxf.entities[i].colorIndex==0) {
									colors[0]='#FFFFFF'; //default ?
								}
								else if (typeof(dxf.entities[i].colorIndex)!='undefined' && dxf.entities[i].colorIndex!=0) {
									var color_num = dxf.entities[i].colorIndex;
					
									if (color_num>256) {
										if (p3d.dxf_color_codes.indexOf(color_num)!=-1) { //non standard color format
											color_num = p3d.dxf_color_codes.indexOf(color_num);
										} 
										else {
											color_num = 7; //white
										}
									}
									colors[color_num]='#'+p3dToHex(p3d.dxf_color_codes[color_num], 6);
								}

								else {
					//				colors[0]='#FFFFFF'; //default ?
								}
							}
						}
						if(colors.length==0 && dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) {
							for (const [key, obj] of Object.entries(dxf.tables.layer.layers)) {
								if (obj.visible) {
									var color_num = obj.colorIndex;
									colors[color_num]='#'+p3dToHex(p3d.dxf_color_codes[color_num], 6);
								}
							}
						}
						p3d.analyse_queue[file_id].colors = colors;
						if (file_ext=='dxf' || jQuery('#'+file_id).find('select[name=product_printer] option:selected').data('type')=='laser_cutting') {
							//inject cutting instructions here
							//var cutting_instructions_html = '<div class="p3d-cutting-instructions">'+p3d.text_cutting_instructions;
							var selects_html='';

							jQuery.each( p3d.analyse_queue[file_id].colors, function( key, color ) {
								if (typeof(color)=='undefined') return;	
 
								selects_html+='<tr>';
								selects_html+='<td><div class="p3d-circle" style="color:'+color+';"></div></td>';
								selects_html+='<td>';
								selects_html+='<select autocomplete="off" onchange="p3dSelectCuttingInstructionsBulk(\''+file_id+'\', this)" name="p3d_cutting_instructions[\''+color+'\']">';
		
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
								jQuery('#'+file_id).find('.p3d-stats-bulk').append(selects_html);
							}
						}

						var loader = new THREE3DP.FontLoader();
						loader.load( p3d.plugin_url+'includes/ext/fonts/helvetiker_bold.typeface.json', function ( response ) {
							p3d.font = response;
//ThreeDxf.Viewer(dxf, document.getElementById('p3d-viewer'), jQuery('#p3d-cv').width(), jQuery('#p3d-cv').height(), p3d.font);
							var cvs = new ThreeDxf.Viewer(dxf, document.body, 100, 100, p3d.font);
							p3d.analyse_queue[file_id].bb = p3d.boundingBox;
							p3d.analyse_queue[file_id].dim_x=((p3d.analyse_queue[file_id].bb.max.x-p3d.analyse_queue[file_id].bb.min.x)/10).toFixed(2);
							p3d.analyse_queue[file_id].dim_y=((p3d.analyse_queue[file_id].bb.max.y-p3d.analyse_queue[file_id].bb.min.y)/10).toFixed(2);
							p3d.analyse_queue[file_id].dim_z=((jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness'))/10).toFixed(2);
//							console.log(jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness'))


						})
					},
					fail : function() {
						alert(p3d.text_file_does_not_exist);
					}
				});
			}
	
			p3dAnalyseModelBulk (file.id);
		},
		UploadComplete: function(p3d_uploader, files) {

			if (p3d.api_repair!='on' && p3d.server_triangulation=='on') { //need to force repair for obj models
				jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
					var file_id = value.id;
					if (typeof(p3d.analyse_queue[file_id].triangulation_required) != 'undefined' && p3d.analyse_queue[file_id].triangulation_required == true) {
						p3d.analyse_queue[file_id].repair_status = 0;
					}
					if (p3d.api_render=='on') {
						if (typeof(p3d.analyse_queue[file_id].repair_status) == 'undefined') {
							p3d.analyse_queue[file_id].repair_status = 0;
						}
					}
				});
				p3dRepairModelsBulk();
			}
			else if (p3d.api_repair=='on' || p3d.api_optimize=='on' || p3d.api_render=='on') {
				jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
					var status = 0;
					var file_id = value.id;
					if (typeof(p3d.analyse_queue[file_id].repair_status) == 'undefined') {
						p3d.analyse_queue[file_id].repair_status = 0;
					}
				});

				p3dRepairModelsBulk();
			}
			else {
				jQuery('#p3d-calculate-price-button').prop('disabled', false);
				jQuery('#p3d-calculate-loader').hide();
			}
		}
		}
	});


});

function p3dHideInactiveGroupsBulk(obj) {
	jQuery(obj).find('optgroup').each(function(){
		var total_items = jQuery(this).find('option').length;
		var total_inactive_items = jQuery(this).find('option:disabled').length;
		if (total_items>0 && total_inactive_items>=total_items) {
			jQuery(this).hide();
		}
		else {
			jQuery(this).show();
		}

	})
}

function p3dSelectCuttingInstructionsBulk(file_id, self) {
//	p3dSelectCuttingInstructionsBulk();
//console.log(file_id);
	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
//		p3d.analyse_queue[file_id].material_id=material_id;
		var cutting_instructions = '';
//console.log(jQuery(self).closest('.p3d-stats-bulk').find('select[name^=p3d_cutting_instructions]').length);
		jQuery(self).closest('.p3d-stats-bulk').find('select[name^=p3d_cutting_instructions]').each(function(i,obj) {
			var start = jQuery(obj).prop('name').indexOf('[')+2;
			var end = jQuery(obj).prop('name').indexOf(']')-1;
			var index = jQuery(obj).prop('name').substring(start, end);
			cutting_instructions += index+'='+jQuery(obj).val()+',';
		})
//		console.log(cutting_instructions);
		p3d.analyse_queue[file_id].cutting_instructions = cutting_instructions;
	}
	p3dAnalyseModelBulk(file_id);
}
function p3dSelectCustomAttribute(obj) {
	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id');
	var attribute_name = jQuery(obj).data('id');
	var attribute_value = jQuery(obj).val();
//	console.log(attribute_name+'='+attribute_value);
	if (typeof(p3d.analyse_queue[file_id].custom_attributes) != 'undefined') {
		var custom_attributes = p3d.analyse_queue[file_id].custom_attributes;
	}
	else {
		var custom_attributes = [];
	}
	custom_attributes[attribute_name]=attribute_value;

	p3d.analyse_queue[file_id].custom_attributes = custom_attributes;
	p3dAnalyseModelBulk(file_id);
}
function p3dSelectFilamentBulk(obj) {
	var material_id = jQuery(obj).val();
	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id');
//	var filename = p3d.analyse_queue[file_id].server_name;
//	var file_ext = filename.split('.').pop().toLowerCase();
//console.log(material_id);

	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].material_id=material_id;
	}
//console.log(material_id);

	if (p3d.selection_order=='materials_printers') {
		//check compatible printers
		var compatible_printers = new Array();
		jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_printer] option').each(function() {
			var materials = jQuery(this).data('materials')+'';
			var materials_array = materials.split(',');
			var printer_id = jQuery(this).val();

			if (materials.length>0 && jQuery.inArray(material_id+'', materials_array)==-1) {
				jQuery(this).prop('disabled', true); 
				p3dInitSelect2Bulk();
			}
			else {
				jQuery(this).prop('disabled', false); 
				p3dInitSelect2Bulk();
				compatible_printers.push(printer_id);
			}
		});
		//check if a compatible printer is already selected
		var selected = false;
		for (var i=0;i<compatible_printers.length;i++) {
			if (jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_printer]').val()==compatible_printers[i])
				selected = true;
				p3dSelectPrinterBulk(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_printer]'));
		}

		if (!selected && compatible_printers.length>0) {
			jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_printer]').val(compatible_printers[0]);
			p3dSelectPrinterBulk(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_printer]'));
		}
	}
	//check compatible coatings
	var compatible_coatings = new Array();

	jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_coating] option').each(function() {
		var materials = jQuery(this).data('materials')+'';
		var materials_array = materials.split(',');
		var coating_id = jQuery(this).val();

		if (materials.length>0 && jQuery.inArray(material_id+'', materials_array)==-1) {
			jQuery(this).prop('disabled', true); 
			p3dInitSelect2Bulk();

		}
		else {
			jQuery(this).prop('disabled', false); 
			p3dInitSelect2Bulk();
			compatible_coatings.push(coating_id);
		}
	});

	//check if a compatible coating is already selected
	var selected = false;
	for (var i=0;i<compatible_coatings.length;i++) {
		if (jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_coating]').val()==compatible_coatings[i])
			selected = true;
	}

	if (!selected && compatible_coatings.length>0) {
		jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_coating]').val(compatible_coatings[0]);
		p3dSelectCoatingBulk(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_coating]'));
	}

	//check compatible postprocessings
	var compatible_postprocessings = new Array();

	jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_postprocessing] option').each(function() {
		var materials = jQuery(this).data('materials')+'';
		var materials_array = materials.split(',');
		var postprocessing_id = jQuery(this).val();

		if (materials.length>0 && jQuery.inArray(material_id+'', materials_array)==-1) {
			jQuery(this).prop('disabled', true); 
			jQuery(this).prop('selected', false); 
			p3dInitSelect2Bulk();

		}
		else {
			jQuery(this).prop('disabled', false); 
			p3dInitSelect2Bulk();
			compatible_postprocessings.push(postprocessing_id);
		}
	});




	var material_name=jQuery(obj).data('name');
	var material_color=jQuery(obj).data('color');

	p3dGetStatsBulk();
	p3dCheckPrintabilityBulk();
	p3dAnalyseModelBulk(file_id);
        p3dHideInactiveGroupsBulk(obj);
	

	window.wp.event_manager.doAction( '3dprint.selectFilament');
}


function p3dSelectPrinterBulk(obj) {
	var printer_id = jQuery(obj).val();

//	if (jQuery(obj).prop('disabled')) return false; //todo ?

	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')

	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].printer_id=printer_id;
	}

	var materials = jQuery(obj).find('option[data-id='+printer_id+']').data('materials')+'';
	var materials_array = materials.split(',');
	
	var infills = jQuery(obj).find('option[data-id='+printer_id+']').data('infills')+'';
	var infills_array = infills.split(',');

	var default_infill = jQuery(obj).find('option[data-id='+printer_id+']').data('default-infill');

	p3d.printer_error = false;
	var new_printer = jQuery(obj);

	p3dInitSelect2Bulk();
	if (p3d.selection_order=='printers_materials') {
		//check compatible materials
		var compatible_materials = new Array();
		jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament] option').each(function() {
			var material_id = jQuery(this).data('id');
			if (materials.length>0 && jQuery.inArray(material_id+'', materials_array)==-1) {
				jQuery(this).prop('disabled', true);
			}
			else {
				jQuery(this).prop('disabled', false);
				compatible_materials.push(material_id);
	
			}
		});
		//check if a compatible material is already selected
		var selected = false;
		for (var i=0;i<compatible_materials.length;i++) {
			if (jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament]').val()==compatible_materials[i])
				selected = true;
		}
		if (!selected && compatible_materials.length>0) {
			jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament]').val(compatible_materials[0]);
			p3dSelectFilamentBulk(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament]'));
		}
	}


	var printer_name=jQuery(obj).find('option[data-id='+printer_id+']').data('name');
	var printer_type=jQuery(obj).find('option[data-id='+printer_id+']').data('type');


	if (jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]').length>0) {

		if (printer_type=='laser_cutting' || printer_type=='other') {
			jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]').hide()
		}
		else if (p3d.show_infills=='on') {
			jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]').show()
		}
		//check compatible infills
		var compatible_infills = new Array();

		jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]').find('option').each(function() {

			if (infills.length>0 && jQuery.inArray(jQuery(this).data('id')+'', infills_array)==-1) {
	
				jQuery(this).prop('disabled', true); p3dInitSelect2Bulk();
			}
			else {
				jQuery(this).prop('disabled', false); p3dInitSelect2Bulk();
				compatible_infills.push(jQuery(this).data('id'));
			}
		});
		//check if a compatible infill is already selected
		var selected = false;
		if (!selected && compatible_infills.length>0) {

			for (var i=0;i<compatible_infills.length;i++) {
				if (compatible_infills[i] == default_infill) {
					jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]').val(compatible_infills[i]);
					p3dSelectInfillBulk(jQuery(obj).closest('.p3d-stats-bulk').find('select.p3d-dropdown-searchable-bulk[name=product_infill]'));
				}
	
			}
		}
	}


	if (printer_type=='other') {
		jQuery('#infill-info').css('visibility', 'hidden');
		jQuery('#tr-stats-print-time').hide();

	}
	else if (printer_type=='laser_cutting') {
		jQuery('#infill-info').css('visibility', 'hidden');
//		jQuery(obj).closest('.p3d-stats-bulk')
//p3d.analyse_queue[file_id].colors

//		if (typeof(p3d.analyse_queue[file_id])!='undefined' && typeof(p3d.analyse_queue[file_id].colors) != 'undefined') {
//todo



//		}

//		selects_html+='</table>';


	}
	else {
		if (p3d.show_infills=='on') jQuery('#infill-info').css('visibility', 'visible');
		if (p3d.show_model_stats_model_hours=='on') jQuery('#tr-stats-print-time').show();
	}

	p3dGetStatsBulk();

	p3dAnalyseModelBulk(jQuery(obj).closest('li.plupload_delete').prop('id'));


	p3dHideInactiveGroupsBulk(obj)
	
	window.wp.event_manager.doAction( '3dprint.selectPrinterBulk');
}

function p3dSelectInfillBulk(obj) {

	var $select = jQuery(obj);
	var infill = $select.val();

	var file_id = $select.closest('li[class^=plupload]').prop('id')

	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].infill=infill;
	}

//	jQuery(obj).val(infill)
	p3dInitSelect2();

	var infill_name = $select.data('name');
	p3dAnalyseModelBulk($select.closest('li[class^=plupload]').prop('id'));
	if (typeof motqnSyncInfillSliderFromSelect === 'function') {
		motqnSyncInfillSliderFromSelect($select);
	}
}

function p3dSelectCoatingBulk(obj) {
        var coating_id = jQuery(obj).val();

	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')

	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].coating_id=coating_id;
	}


	jQuery(obj).val(coating_id); 

	p3dInitSelect2Bulk();


	var coating_name=jQuery(obj).data('name');
	var material_color=jQuery(obj).data('color');

	if (typeof(document.getElementById('p3d-coating-name'))!=='undefined') {
		jQuery('#p3d-coating-name').html(p3d.text_coating+' : <div style="background-color:'+material_color+'" class="p3d-color-sample"></div>'+coating_name);
	}

	if (jQuery(obj).hasClass('p3d-color-item')) {
		jQuery(obj).closest('.p3d-fieldset').find('.p3d-color-item').removeClass('p3d-active');
		jQuery(obj).addClass('p3d-active');
	}

	p3dGetStatsBulk();
	p3dAnalyseModelBulk(file_id);
	window.wp.event_manager.doAction( '3dprint.selectCoating');
}

function p3dSelectPostprocessingBulk(obj, e) {
	e.target.selected = !e.target.selected;
	e.stopPropagation();

        var postprocessing_id = jQuery(obj).val();

	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')
	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].postprocessing_id=postprocessing_id;
	}


	jQuery(obj).val(postprocessing_id); 

	p3dInitSelect2Bulk();


	var postprocessing_name=jQuery(obj).data('name');
	var material_color=jQuery(obj).data('color');

	if (typeof(document.getElementById('p3d-postprocessing-name'))!=='undefined') {
		jQuery('#p3d-postprocessing-name').html(p3d.text_postprocessing+' : <div style="background-color:'+material_color+';" class="p3d-color-sample"></div>'+postprocessing_name);
	}

	if (jQuery(obj).hasClass('p3d-color-item')) {
		jQuery(obj).closest('.p3d-fieldset').find('.p3d-color-item').removeClass('p3d-active');
		jQuery(obj).addClass('p3d-active');
	}

	p3dGetStatsBulk();
	p3dAnalyseModelBulk(file_id);

	window.wp.event_manager.doAction( '3dprint.selectPostprocessing');
	return false;
}


function p3dInitSelect2Bulk() {

}

function p3dGetStatsBulk() {
}
function p3dCheckPrintabilityBulk() {
}

function p3dSelectUnitBulk(obj) {
	var unit = jQuery(obj).val();
	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')

	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].unit=unit;
	}
	if (typeof(p3d_mp)!='undefined' && p3d_mp.force_repair_on_scale=='on') {
		jQuery('#p3d-calculate-price-button').prop('disabled', true);
		jQuery('#p3d-calculate-loader').show();
		jQuery('#p3d-submit-button').prop('disabled', true);
		p3d.analyse_queue[file_id].repair_status = 0;
//		p3d.xhr3.abort(); p3d.xhr4.abort();
		if(p3d.xhr3 && p3d.xhr3.readyState != 4) {
			p3d.xhr3.abort();
			p3d.xhr3.readyState = 4;
		}
		if(p3d.xhr4 && p3d.xhr4.readyState != 4) {
			p3d.xhr4.abort();
			p3d.xhr4.readyState = 4;
		}
		clearInterval(p3d.refresh_interval_repair);
		p3d.repairing=false;
		p3dRepairModelBulk(file_id);
	}
	p3dAnalyseModelBulk(file_id);
}

function p3dSelectQTYBulk(obj) {
        var $input = jQuery(obj);
        var qty = parseFloat($input.val());
        var file_id = $input.closest('li[class^=plupload]').prop('id');

        if (isNaN(qty) || qty < 1) {
                qty = 1;
        }

        $input.val(qty);

        if (typeof(p3d.analyse_queue[file_id])!='undefined') {
                var fileData = p3d.analyse_queue[file_id];
                fileData.qty = qty;

                if (typeof fileData.price !== 'undefined') {
                        var totalPrice = fileData.price * qty;
                        var formattedTotal = motqnFormatCurrency(totalPrice);

                        fileData.total_price = totalPrice;
                        fileData.html_price_total = formattedTotal;
                        fileData.html_price = formattedTotal;

                        $input.closest('li[class^=plupload]').find('.plupload_file_price-tag--total .plupload_file_price-tag-value').text(formattedTotal);
                }
        }
}

function motqnFormatCurrency(value) {
        if (p3d.price_num_decimals<0) {
                return accounting.formatMoney(p3dRoundPrice(value), p3d.currency_symbol, 0, p3d.thousand_sep, p3d.decimal_sep);
        }

        return accounting.formatMoney(value, p3d.currency_symbol, p3d.price_num_decimals, p3d.thousand_sep, p3d.decimal_sep);
}

function motqnUpdateStatus($statusEl, message, state) {
        if (!$statusEl || !$statusEl.length) {
                return;
        }

        if (typeof message !== 'undefined' && message !== null) {
                $statusEl.html(message);
        }

        if (typeof state !== 'undefined') {
                if (state === null || state === '') {
                        $statusEl.removeAttr('data-state');
                }
                else {
                        $statusEl.attr('data-state', state);
                }
        }

        var fileId = $statusEl.closest('li[class^=plupload]').prop('id');
        if (fileId && typeof(p3d.analyse_queue[fileId])!='undefined') {
                if (typeof message !== 'undefined' && message !== null) {
                        p3d.analyse_queue[fileId].html_status = $statusEl.html();
                }
                if (typeof state !== 'undefined') {
                        p3d.analyse_queue[fileId].status_state = state;
                }
        }
}
function p3dSaveComments(obj) {
	var comments = jQuery(obj).val();
	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')
	if (typeof(p3d.analyse_queue[file_id])!='undefined') {
		p3d.analyse_queue[file_id].comments=comments;
	}
}

function p3dRepairModelBulk(file_id) {
//	if (p3d.api_repair!='on' && p3d.api_optimize!='on') return; //may be forced
	if (typeof(file_id)=='undefined') return;
	if (typeof(p3d.analyse_queue[file_id])=='undefined') return;
	if (p3d.repairing) return;



	var obj = document.getElementById(file_id);	
	var printer_type = jQuery(obj).find('select[name=product_printer] option:checked').data('type')
	var printer_id = jQuery(obj).find('select[name=product_printer]').val()
	var material_type = jQuery(obj).find('select[name=product_filament] option:checked').data('type')
	var unit = jQuery(obj).find('select[name=product_unit]').val()
	var optimize = p3d.api_optimize;
	if (typeof(jQuery(obj).find('select[name=product_printer] option:checked').data('optimize'))!='undefined') {
		if (parseInt(jQuery(obj).find('select[name=product_printer] option:checked').data('optimize'))==0) {
			optimize = '0';
		}
	}

	if ((printer_type=='laser_cutting' || material_type=='laser_cutting') && p3d.api_render!='on') return; 

	var filename = p3d.analyse_queue[file_id].server_name;
	var file_ext = filename.split('.').pop().toLowerCase();

	p3d.repairing = true;
	p3d.analyse_queue[file_id].repair_status = 0;

	if(p3d.analyse_queue[file_id].xhr3 && p3d.analyse_queue[file_id].xhr3.readyState != 4) {
		p3d.analyse_queue[file_id].xhr3.abort();
	}

	var repair = p3d.api_repair;
	if (typeof(p3d.analyse_queue[file_id].triangulation_required) != 'undefined' && p3d.analyse_queue[file_id].triangulation_required == true) {
		var repair = 'on';
	}
        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_repairing_model, 'repairing');


//console.log('QQQ')
	p3d.xhr3=jQuery.ajax({
		method: "POST",
		type: "POST",
		url: p3d.url,
		data: { 
			action: "p3d_handle_repair", 
			repair: repair,
			printer_id: printer_id,
			product_id: jQuery('#p3d-product-id').val(),
			optimize: optimize,
			render: p3d.api_render,
			unit: unit,
			scale_x: 1,
			scale_y: 1,
			scale_z: 1,
			rotate_x: 0,
			rotate_y: 0,
			filename: filename
		      }
		})
		.done(function( msg ) {
			var data = jQuery.parseJSON( msg );
                        if (data.status=='0') {
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_repairing_model, 'repairing');
                                if (typeof(data.error)!=='undefined') {
                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repair_failed + ' : ' + data.error.message, 'error');
				}
				if (p3d.pricing=='checkout' && p3d.pricing_irrepairable=='request') {
					p3d.analyse_queue[file_id].fatal_error=1;
					p3d.analyse_queue[file_id].repair_status=-1;
					p3d.analyse_queue[file_id].new_pricing='request';
				}
				p3d.analyse_queue[file_id].repair_status=-1;
				p3d.repairing = false;
				p3dRepairModelsBulk();
			}
			else if (data.status=='2') {

				var server = data.server;
				p3d.repairing = true;
				p3d.analyse_queue[file_id].repair_status=2;
				p3d.refresh_interval_repair = setInterval(function(){
				    p3dRepairCheckBulk(filename, server, obj); 
				}, 3000);
			
			}
			else if (typeof(data.error)!=='undefined') {

				p3d.repairing = false;
				clearInterval(p3d.refresh_interval_repair);
				p3d.repair_error = true;
				p3d.analyse_queue[file_id].repair_status=-1;
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repair_failed + ' : ' + data.error.message, 'error');
				if (p3d.pricing=='checkout' && p3d.pricing_irrepairable=='request') {
					p3d.analyse_queue[file_id].fatal_error=1;
					p3d.analyse_queue[file_id].repair_status=-1;
					p3d.analyse_queue[file_id].new_pricing='request';
				}
				p3dRepairModelsBulk();
				return false;
	
			}
		});
}

function p3dRepairCheckBulk (filename, server, obj) {

	if(p3d.xhr4 && p3d.xhr4.readyState != 4) {
		return;
	}

	var printer_type = jQuery(obj).find('select[name=product_printer] option:checked').data('type')
	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id')
	var repair = p3d.api_repair;
	if (typeof(p3d.analyse_queue[file_id].triangulation_required) != 'undefined' && p3d.analyse_queue[file_id].triangulation_required == true) {
		var repair = 'on';
	}

	p3d.xhr4=jQuery.ajax({
		method: "POST",
		type: "POST",
		url: p3d.url,
		data: { 
			action: "p3d_handle_repair_check", 
			repair: repair, 
			optimize: p3d.api_optimize, 
			render: p3d.api_render,
			printer_type: printer_type,
			product_id: jQuery('#p3d-product-id').val(),
			server: server,
			filename: filename 
		      }
		})
		.done(function( msg ) {
			var data = jQuery.parseJSON( msg );


			if (typeof(data.rendered_file_url)!=='undefined' && data.rendered_file_url.length>0) {
				//todo set thumnbail
				p3d.analyse_queue[file_id].thumbnail_url = data.rendered_file_url;
				jQuery(obj).find('.plupload_file_image').html('<a target="_blank" href="'+data.rendered_file_url+'"><img class="plupload_model_image" src="'+data.rendered_file_url+'"></a>');
			}

			if (typeof(data.dxf_bb)!=='undefined' && data.dxf_bb) {
				if (!(data.dxf_bb.x_min==null || data.dxf_bb.x_max==null || data.dxf_bb.y_min==null || data.dxf_bb.y_max==null)) { //dxf file may be broken
					p3d.boundingBox.min.x = parseFloat(data.dxf_bb.x_min);
					p3d.boundingBox.max.x = parseFloat(data.dxf_bb.x_max);
					p3d.boundingBox.min.y = parseFloat(data.dxf_bb.y_min);
					p3d.boundingBox.max.y = parseFloat(data.dxf_bb.y_max);
					p3d.analyse_queue[file_id].bb=p3d.boundingBox;
					p3d.analyse_queue[file_id].dim_x=((p3d.analyse_queue[file_id].bb.max.x-p3d.analyse_queue[file_id].bb.min.x)/10).toFixed(2);
					p3d.analyse_queue[file_id].dim_y=((p3d.analyse_queue[file_id].bb.max.y-p3d.analyse_queue[file_id].bb.min.y)/10).toFixed(2);

				}
			}

			if (data.status=='1') {
				p3d.repairing = false;
				clearInterval(p3d.refresh_interval_repair);
				var data = jQuery.parseJSON( msg );
                                p3d.analyse_queue[file_id].repair_status=1;
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), '&nbsp;', 'idle');

				if (typeof(data.filename)!=='undefined' && data.filename.length>0) {
                                        p3d.new_pricing='';
					p3d.analyse_queue[file_id].server_name = data.filename;
					var model_type=data.filename.split('.').pop().toLowerCase();

                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repaired, 'complete');

					if (typeof(p3d_mp)!='undefined' && p3d.api_repair=='on' && data.mp_grade_has_issues) {
						var model_errors = '<table class="p3d-model-errors">' + 
							'<tr><td>'+p3d.text_model_repair_nonmanifold_edges+'</td><td>'+data.mp_grade_nonmanifold+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_boundary_edges+'</td><td>'+data.mp_grade_boundary+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_flipped_faces+'</td><td>'+data.mp_grade_flipped+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_inter+'</td><td>'+data.mp_grade_inter+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_thick+'</td><td>'+data.mp_grade_thick+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_clear+'</td><td>'+data.mp_grade_clear+'</td></tr>' + 
							'</table>';
						
//						jQuery('#p3d-repair-message').html('<b>'+p3d.text_model_repair_report +'</b>'+ model_errors);
						p3d.analyse_queue[file_id].html_error_report = '<b>'+p3d.text_model_repair_report +'</b><br>'+ model_errors;
					}
					
					if (repair=='on' && data.needed_repair=='yes') {
						var model_errors = '<table class="p3d-model-errors">' + 
							'<tr><td>'+p3d.text_model_repair_degenerate_facets+'</td><td>'+data.degenerate_facets+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_edges_fixed+'</td><td>'+data.edges_fixed+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_facets_removed+'</td><td>'+data.facets_removed+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_facets_added+'</td><td>'+data.facets_added+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_facets_reversed+'</td><td>'+data.facets_reversed+'</td></tr>' + 
							'<tr><td>'+p3d.text_model_repair_backwards_edges+'</td><td>'+data.backwards_edges+'</td></tr>' + 
							'</table>';
						p3d.analyse_queue[file_id].html_error_report = '<b>'+p3d.text_model_repair_report +'</b><br>'+ model_errors;
					}
					if (typeof(data.progress_phase)!='undefined' && typeof(data.progress)!='undefined') {
                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repaired +'&nbsp;'+data.progress+'%', 'repairing');
					}
					if (repair=='on' && data.needed_repair=='no') {
                                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repaired, 'complete');
						p3dRepairModelsBulk();
						return;
					}

                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repaired, 'complete');
				}
				else if (data.needed_repair=='no') {
                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_no_repair_needed, 'complete');
				} 
				else if (typeof(data.rendered_file_url)!='undefined' && data.rendered_file_url.length) {
					p3d.analyse_queue[file_id].repair_status=1;
				}
				else {//something went wrong
					p3d.analyse_queue[file_id].repair_status=-1;
				}

				p3dRepairModelsBulk();

			}
			else if (data.status=='2') {
				if (typeof(data.progress_phase)!='undefined' && typeof(data.progress)!='undefined') {
                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), data.progress_phase +'&nbsp;'+data.progress+'%', 'repairing');
				}

			}
			else if (data.status=='0') {
				p3d.repairing = false;
				clearInterval(p3d.refresh_interval_repair);
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repair_failed, 'error');
				if (typeof(data.error)!=='undefined') { 

                                        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_repair_failed + ' : ' + data.error.message, 'error');
				}
				if (p3d.pricing=='checkout' && p3d.pricing_irrepairable=='request') {
					p3d.analyse_queue[file_id].fatal_error=1;
					p3d.analyse_queue[file_id].new_pricing='request';
				}
				p3d.analyse_queue[file_id].repair_status=-1;
				p3dRepairModelsBulk();

			}
			else if (typeof(data.error)!=='undefined') {
				p3d.repairing = false;
				clearInterval(p3d.refresh_interval_repair);
				p3d.repair_error = true;

                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), data.error.message, 'error');

				if (p3d.pricing=='checkout' && p3d.pricing_irrepairable=='request') {
					p3d.analyse_queue[file_id].fatal_error=1;
					p3d.analyse_queue[file_id].new_pricing='request';
				}
				p3d.analyse_queue[file_id].repair_status=-1;
				p3dRepairModelsBulk();
				return false;
	
			}


		});


}
function p3dRepairModelsBulk() {
	var any_to_repair = false;
	jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
		var status = 0;
		var file_id = value.id;
		if (p3d.analyse_queue[file_id].repair_status == 0) {
			any_to_repair = true;
			p3dRepairModelBulk(file_id);
		}
	
	});
	if (!any_to_repair) {
		jQuery('#p3d-calculate-price-button').prop('disabled', false);
		jQuery('#p3d-calculate-loader').hide();
	}
}
function p3dAnalyseModelBulk(file_id) {
	if (typeof(file_id)=='undefined') return;
	if (typeof(p3d.analyse_queue[file_id])=='undefined') return;
	if (typeof(p3d.analyse_queue[file_id].repair_status)!='undefined' && p3d.analyse_queue[file_id].repair_status==-1) {
		return;
	}
	clearInterval(p3d.refresh_interval);	              

	p3d.analyse_queue[file_id].analyse_status = 0;
	p3d.analyse_queue[file_id].new_pricing = false;
	p3d.analyse_requested = true;
	jQuery('#p3d-calculate-price-button').show();
	jQuery('#p3d-submit-button').prop('disabled', true);
}

function p3dAnalyseModelsBulk() {
	jQuery('#p3d-calculate-price-button').hide();

	p3d.analyse_ajax_interval_bulk = setInterval(function(){
		jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
			var status = 0;
			var file_id = value.id;
			if (typeof(value.analyse_status)!='undefined') {

				if (value.analyse_status==0 && value.uploaded) {
					status = value.status;
					obj = document.getElementById(file_id);
					p3d.analyse_requested = true;
					p3dAnalyseModelAJAXBulk (obj, status);
					return false; //break
				}
				else {
					p3d.analyse_requested = false;
					return; //continue
				}
			}
			else return;

		});

		jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
			
			if (typeof(value.analyse_status)!='undefined') {

				if ((value.analyse_status==0 || value.analyse_status==2) && value.uploaded) {
					p3d.all_finished = false;
					return false; //break
				}
				else {
					p3d.all_finished = true;
					return; //continue
				}
			}
		})
		if (p3d.all_finished) {
			clearInterval(p3d.analyse_ajax_interval_bulk);
		}

		p3dCheckAllFinished();

	}, 1000);
}

function p3dAnalyseModelAJAXBulk (obj, status) {
	if (typeof(obj)=='undefined') return;
	if (status!=5) return;
	if (p3d.analysing) return;

	if (Object.keys(p3d.analyse_queue).length==0) return;

	//todo maybe sort by size



	var file_id = jQuery(obj).prop('id');
	var dim_x = dim_y = dim_z = 0;
        motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_bulk_analysing+' 1%', 'analysing');

	if(p3d.analyse_queue[file_id] && p3d.analyse_queue[file_id].xhr1 && p3d.analyse_queue[file_id].xhr1.readyState != 4) {
		p3d.analyse_queue[file_id].xhr1.abort();
		p3d.analysing = false;
		p3d.analyse_queue[file_id].analyse_status = 0;
	}
	if(p3d.analyse_queue[file_id] && p3d.analyse_queue[file_id].xhr2 && p3d.analyse_queue[file_id].xhr2.readyState != 4) {
		p3d.analyse_queue[file_id].xhr2.abort();
		p3d.analysing = false;
		p3d.analyse_queue[file_id].analyse_status = 0;
	}

	if (typeof(p3d.analyse_queue[file_id].dim_x)!='undefined') {
		dim_x = p3d.analyse_queue[file_id].dim_x;
	}
	if (typeof(p3d.analyse_queue[file_id].dim_y)!='undefined') {
		dim_y = p3d.analyse_queue[file_id].dim_y;
	}
	if (typeof(p3d.analyse_queue[file_id].dim_z)!='undefined') {
		dim_z = ((jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness'))/10).toFixed(2)
	}
/*
p3d.analyse_queue[file_id].dim_x
*/
	
	var triangulation_required = false;
	var printer_type = jQuery(obj).find('select[name=product_printer] option:checked').data('type')
	var printer_id = jQuery(obj).find('select[name=product_printer]').val();
	var infill = jQuery(obj).find('select[name=product_infill]').val();
	var infill_id = jQuery(obj).find('select[name=product_infill] option:checked').data('infill-id');
	var printer_id = jQuery(obj).find('select[name=product_printer]').val()
       	var material_id = jQuery(obj).find('select[name=product_filament]').val();
	var unit = jQuery(obj).find('select[name=product_unit]').val();
	var filename = p3d.analyse_queue[file_id].server_name;
	jQuery('#p3d-repair-image').hide();
	var price_field = jQuery(obj).find('.plupload_file_status');

	var cutting_instructions = '';
	var postprocessing = jQuery(obj).find('select[name=product_postprocessing]').val();

	var custom_attributes = {};
	jQuery(obj).find('select[name^=p3d_cutting_instructions]').each(function(i, select_obj) {
		var start = jQuery(select_obj).prop('name').indexOf('[')+2;
		var end = jQuery(select_obj).prop('name').indexOf(']')-1;
		var obj_color = jQuery(select_obj).prop('name').substring(start, end);
		var obj_instruction = jQuery(select_obj).val();
		cutting_instructions+=obj_color+'='+obj_instruction+',';
	});

	jQuery(obj).find('select[name^=attribute_pa]').each(function(i, select_obj) {
		var attribute_name = jQuery(select_obj).data('id');
		var attribute_value = jQuery(select_obj).val();
		custom_attributes[attribute_name]=attribute_value;
	});
//console.log(custom_attributes);
//console.log(JSON.stringify(custom_attributes));

	if (p3d.analyse_requested) {
	p3d.analysing = true;
	p3d.analyse_queue[file_id].xhr1=jQuery.ajax({
		method: "POST",
		type: "POST",
		url: p3d.url,
		data: { action: "p3d_handle_analyse", 
			product_id: jQuery('#p3d-product-id').val(),
			printer_id: printer_id,
			material_id: material_id,
			filename: filename, 
			infill: infill,
			infill_id: infill_id,
			cutting_instructions: cutting_instructions,
			custom_attributes: JSON.stringify(custom_attributes),
			postprocessing: postprocessing,
			scale: 1,
			p3d_dim_x: dim_x,
			p3d_dim_y: dim_y,
			p3d_dim_z: dim_z,
			unit: unit,
			triangulation: triangulation_required,
			api_analyse: p3d.api_analyse,
			bulk: true,
			calculate_price: true
		      }
		})
		.done(function( msg ) {
			var data = jQuery.parseJSON( msg );
			
			if (typeof(data.error)!=='undefined') {
				p3d.analysing = false;
				jQuery('#p3d-submit-button').prop('disabled', false);
				p3d.analyse_queue[file_id].analyse_status = -1;
				if (data.error.code==120) {
					if (p3d.pricing_too_large=='request') {
						p3d.analyse_queue[file_id].fatal_error = 1;
						p3d.analyse_queue[file_id].new_pricing = 'request';
					}
				}
				else if (data.error.code==121) {
					if (p3d.pricing_too_small=='request') {
						p3d.analyse_queue[file_id].fatal_error = 1;
						p3d.analyse_queue[file_id].new_pricing = 'request';
					}
				}
				else if (p3d.pricing_api_expired=='request') {
					p3d.analyse_queue[file_id].fatal_error = 1;
					p3d.analyse_queue[file_id].new_pricing = 'request';
				}

                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), data.error.message, 'error');


				return false;

			}

			if (data.status == '2') { //in progress
				var server = data.server;
				p3d.checking = true;
			        p3dDisplayPrice(false);

                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_bulk_analysing+' 10%', 'analysing');
				p3d.analyse_queue[file_id].analyse_status = 2;

				p3d.refresh_interval = setInterval(function(){
				    p3danalyseCheckBulk(filename, server, obj); 
				}, 3000);

				
			}
			else if (data.status == '1') { //success, no API
				//todo also add PHP model stats
				p3d.analysing = false;
				p3d.checking = false;
				p3d.analyse_error = false;

				p3d.triangulated_volume = data.material_volume;
				p3d.triangulated_surface_area = data.surface_area;
				//todo: p3d.triangulated_volume

				p3dShowResponseBulk(obj, data);
				p3d.analyse_queue[file_id].analyse_status = 1;
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_bulk_analysing+' 100%', 'complete');

				p3dCheckAllFinished();

                                motqnUpdateStatus(price_field, p3d.text_bulk_analysing+' 100%', 'complete');
				clearInterval(p3d.refresh_interval);
			}

			else if (data.status == '0') { //failed
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_model_analyse_failed, 'error');
				p3d.analyse_error = true;
				p3d.analysing = false;

				p3d.analyse_queue[file_id].analyse_status = -1;
				if (p3d.pricing_api_expired=='request') {
					p3d.analyse_queue[file_id].fatal_error = 1;
					p3d.analyse_queue[file_id].new_pricing = 'request';
				}
			}

		});
	}
	p3d.analyse_requested=false;
}

function p3danalyseCheckBulk(filename, server, obj) {

	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id');
	if(p3d.analyse_queue[file_id] && p3d.analyse_queue[file_id].xhr2 && p3d.analyse_queue[file_id].xhr2.readyState != 4) {
		return;
	}
	if (p3d.processing) {
		return;
	}
	//var infills = jQuery(obj).find('select[name=product_printer option:checked').data('infills')+'';
	var printer_type = jQuery(obj).find('select[name=product_printer] option:checked').data('type')
	var printer_id = jQuery(obj).find('select[name=product_printer]').val();
	var infill = jQuery(obj).find('select[name=product_infill]').val();
	var infill_id = jQuery(obj).find('select[name=product_infill] option:checked').data('infill-id');
	var printer_id = jQuery(obj).find('select[name=product_printer]').val()
       	var material_id = jQuery(obj).find('select[name=product_filament]').val();
	var unit = jQuery(obj).find('select[name=product_unit]').val();
	var cutting_instructions = '';
	var postprocessing = jQuery(obj).find('select[name=product_postprocessing]').val();
	jQuery(obj).find('select[name^=p3d_cutting_instructions]').each(function(i, select_obj) {
		var start = jQuery(select_obj).prop('name').indexOf('[')+2;
		var end = jQuery(select_obj).prop('name').indexOf(']')-1;
		var obj_color = jQuery(select_obj).prop('name').substring(start, end);
		var obj_instruction = jQuery(select_obj).val();
		cutting_instructions+=obj_color+'='+obj_instruction+',';
	});

	var custom_attributes = {};
	jQuery(obj).find('select[name^=attribute_pa]').each(function(i, select_obj) {
		var attribute_name = jQuery(select_obj).data('id');
		var attribute_value = jQuery(select_obj).val();
		custom_attributes[attribute_name]=attribute_value;
	});


	var dim_x = dim_y = dim_z = 0;
	if (typeof(p3d.analyse_queue[file_id].dim_x)!='undefined') {
		dim_x = p3d.analyse_queue[file_id].dim_x;
	}
	if (typeof(p3d.analyse_queue[file_id].dim_y)!='undefined') {
		dim_y = p3d.analyse_queue[file_id].dim_y;
	}
	if (typeof(p3d.analyse_queue[file_id].dim_z)!='undefined') {
		dim_z = ((jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness'))/10).toFixed(2);
	}

	if  (p3d.pricing == 'checkout') {
	        p3dDisplayAddToCart(false);
	        p3dDisplayQuoteLoading(true);
	}

        p3dDisplayPrice(false);

	if (p3d.analyse_queue[file_id].analyse_status==1 || p3d.analyse_queue[file_id].analyse_status==-1) return;

	p3d.analyse_queue[file_id].xhr2=jQuery.ajax({
		method: "POST",
		type: "POST",
		url: p3d.url,
		data: { action: "p3d_handle_analyse_check", 
			product_id: jQuery('#p3d-product-id').val(),
			printer_id: printer_id,
			material_id: material_id,
			filename: filename, 
			server: server,
			infill: infill,
			infill_id: infill_id,
			scale: 1,
			unit: unit,
			cutting_instructions: cutting_instructions,
			custom_attributes: JSON.stringify(custom_attributes),
			postprocessing: postprocessing,
			p3d_dim_x: dim_x,
			p3d_dim_y: dim_y,
			p3d_dim_z: dim_z,
			triangulation: false,
			calculate_price: true,
			bulk: true
		      }
		})
		.done(function( msg ) {
			var data = jQuery.parseJSON( msg );

			if (typeof(data.error)!=='undefined' && typeof(data.error.new_pricing)=='undefined') {
				p3d.analyse_error = true;
				p3d.analysing = false;
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), data.error.message, 'error');
				if (p3d.pricing_api_expired=='request') p3d.fatal_error=1;
				p3d.analyse_queue[file_id].analyse_status = -1;
				//p3dNewPricingBulk('', p3d.pricing_api_expired, obj);

				if (p3d.pricing_api_expired=='request') {
					p3d.analyse_queue[file_id].fatal_error = 1;
					p3d.analyse_queue[file_id].new_pricing = 'request';
				}
				p3dCheckAllFinished();
				clearInterval(p3d.refresh_interval);
			}
			else if (typeof(data.error)!=='undefined' && typeof(data.error.new_pricing)!=='undefined') {
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), data.error.message, 'error');
				p3d.analyse_queue[file_id].analyse_status = -1;
				p3d.analyse_queue[file_id].fatal_error = 1;
				p3d.analyse_queue[file_id].new_pricing = data.error.new_pricing;
			}
			if (data.status=='1') {
				p3d.checking = false;
				p3d.analyse_error = false;
				p3d.analysing = false;
				p3dShowResponseBulk(obj, data);

				if (typeof(data.print_time)!='undefined' && data.print_time==0 && p3d.api_analyse=='on') {
					if (p3d.pricing_print_time_zero=='request') {
						p3d.analyse_queue[file_id].analyse_status = -1;
						p3d.analyse_queue[file_id].fatal_error = 1;
						p3d.analyse_queue[file_id].new_pricing = 'request';
					}
				}
				p3d.analyse_queue[file_id].analyse_status = 1;

				p3dCheckAllFinished();
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_bulk_analysing+' 100%', 'complete');
				clearInterval(p3d.refresh_interval);
			}
			if (data.status=='2') {
				p3d.analyse_queue[file_id].analyse_status = 2;
                                motqnUpdateStatus(jQuery(obj).find('.plupload_file_status'), p3d.text_bulk_analysing+' '+data.progress+'%', 'analysing');
			}

		});
	
}
function p3dShowResponseBulk(obj, model_stats) {
        var price = 0;
        var html_thumb = '';


	var file_id = jQuery(obj).closest('li[class^=plupload]').prop('id');
	if (p3d.price_num_decimals<0) price = p3dRoundPrice(model_stats.price);
	else price = model_stats.price.toFixed(p3d.price_num_decimals);

	var filename = p3d.analyse_queue[file_id].server_name;
	var file_ext = filename.split('.').pop().toLowerCase();

	var material_thickness = jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness')/10;

//	var printer_name=jQuery(obj).find('option[data-id='+printer_id+']').data('name');

//	console.log(model_stats);

	if (typeof(p3d.analyse_queue[file_id].bb)!='undefined') { //dxf bb
		model_stats.x_dim = p3d.analyse_queue[file_id].bb.max.x - p3d.analyse_queue[file_id].bb.min.x;
		model_stats.y_dim = p3d.analyse_queue[file_id].bb.max.y - p3d.analyse_queue[file_id].bb.min.y;
//		model_stats.z_dim = parseFloat(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament] option:selected').data('laser-cutting-thickness'));
		model_stats.z_dim = jQuery('#'+file_id).find('select[name=product_filament] option:selected').data('laser-cutting-thickness')

//		model_stats.z_dim = p3d.analyse_queue[file_id].bb.max.z - p3d.analyse_queue[file_id].bb.min.z;
//		console.log(jQuery(obj).closest('.p3d-stats-bulk').find('select[name=product_filament] option:selected').data('laser-cutting-thickness'));
//console.log(model_stats);
	}


	jQuery('#p3d-info-bulk .stats-material-volume').html((model_stats.material_volume/1000).toFixed(2));

	if (typeof(p3d.analyse_queue[file_id].thumbnail_url)!='undefined') {
		jQuery('#p3d-info-bulk img.stats_plupload_model_image').prop('src', p3d.analyse_queue[file_id].thumbnail_url).show();
		jQuery('#p3d-info-bulk a.stats_plupload_model_image_link').prop('href', p3d.analyse_queue[file_id].thumbnail_url);
		jQuery('#p3d-cv-bulk').data('p3dv_model_url', p3d.upload_url+p3d.analyse_queue[file_id].server_name);
	}

	if (file_ext=='dxf') {
		model_stats.surface_area = model_stats.x_dim * model_stats.y_dim;
		jQuery('#p3d-info-bulk .tr-stats-material-volume').hide();
		jQuery('#p3d-info-bulk .tr-stats-weight').hide();
		jQuery('#p3d-info-bulk .tr-stats-support-volume').hide();
		jQuery('#p3d-info-bulk .tr-stats-polygons').hide();
//		jQuery('#p3d-info-bulk .p3d-rotation-controls').hide();
		jQuery('#p3d-info-bulk .stats-height').html(material_thickness);

		if (p3d.show_model_stats_shape_number=='on') {
			jQuery('#p3d-info-bulk .tr-stats-shapes').show();
		}
		if (p3d.show_model_stats_total_path=='on') {
			jQuery('#p3d-info-bulk .tr-stats-total-path').show();
		}
	}
	else {
		if (p3d.show_model_stats_material_volume=='on') {
			jQuery('#p3d-info-bulk .tr-stats-material-volume').show();
		}
		if (p3d.show_model_stats_support_material_volume=='on') {
			jQuery('#p3d-info-bulk .tr-stats-support-material-volume').show();
		}
		if (p3d.show_model_stats_box_volume=='on') {
			jQuery('#p3d-info-bulk .tr-stats-box-volume').show();
		}
		if (p3d.show_model_stats_surface_area=='on') {
			jQuery('#p3d-info-bulk .tr-stats-surface-area').show();
		}
		if (p3d.show_model_stats_model_weight=='on') {
			jQuery('#p3d-info-bulk .tr-stats-weight').show();
		}
		if (p3d.show_model_stats_polygon_number=='on') {
			jQuery('#p3d-info-bulk .tr-stats-polygons').show();
		}

		jQuery('#p3d-info-bulk .tr-stats-shapes').hide();
		jQuery('#p3d-info-bulk .tr-stats-total-path').hide();
	}

	if (typeof(model_stats.support_material_volume)!=='undefined') {
		jQuery('#p3d-info-bulk .stats-support-material-volume').html((model_stats.support_material_volume/1000).toFixed(2));
	}

		
	jQuery('#p3d-info-bulk .stats-box-volume').html((model_stats.x_dim/10*model_stats.y_dim/10*model_stats.z_dim/10).toFixed(2));
	jQuery('#p3d-info-bulk .stats-surface-area').html((model_stats.surface_area/100).toFixed(2));
	jQuery('#p3d-info-bulk .stats-width').html((model_stats.x_dim/10).toFixed(2));
	jQuery('#p3d-info-bulk .stats-length').html((model_stats.y_dim/10).toFixed(2));
	jQuery('#p3d-info-bulk .stats-height').html((model_stats.z_dim/10).toFixed(2));
	jQuery('#p3d-info-bulk .stats-weight').html((model_stats.weight).toFixed(2)); 
	if (typeof(model_stats.print_time)!='undefined') {
		jQuery('#p3d-info-bulk .stats-hours').html(new Date(model_stats.print_time * 1000).toISOString().substr(11, 8));
	}
	jQuery('#p3d-info-bulk .stats-total-path').html((parseFloat(model_stats.cut_path)/10).toFixed(2));
	jQuery('#p3d-info-bulk .stats-shapes').html(model_stats.shape_number);
//	var html_stats = '<table>'+jQuery('#p3d-info-bulk .p3d-stats').html()+'</table>';
	var html_stats = jQuery('#p3d-info-bulk').html();
	var html_stats_summary = (typeof window.motqnBuildModelInfoSummary === 'function') ? window.motqnBuildModelInfoSummary(html_stats) : html_stats;
	if (typeof(p3d.analyse_queue[file_id].html_error_report)!='undefined') {
		html_stats += p3d.analyse_queue[file_id].html_error_report;
	}
	p3d.analyse_queue[file_id].html_stats = html_stats;
	p3d.analyse_queue[file_id].html_stats_summary = html_stats_summary;
	p3d.analyse_queue[file_id].dim_x=(model_stats.x_dim/10).toFixed(2);
	p3d.analyse_queue[file_id].dim_y=(model_stats.y_dim/10).toFixed(2);
	p3d.analyse_queue[file_id].dim_z=(model_stats.z_dim/10).toFixed(2);
	jQuery(obj).closest('li[class^=plupload]').find('.plupload_info_icon').css('visibility', 'visible')
        jQuery('#plupload-popup-'+file_id).find('.plupload-content').html(html_stats)

        var $model_info = jQuery('#'+file_id).find('.plupload_model_info');
        if ($model_info.length) {
                $model_info.attr('data-state', 'ready');
                $model_info.find('.plupload_model_info__body').html(html_stats_summary);
        }

        var qty_value = parseFloat(jQuery('#'+file_id).find('.plupload_file_qty input').val());
        if (isNaN(qty_value) || qty_value < 1) {
                qty_value = 1;
        }

        price *= p3d.currency_rate;

        if (p3d.currency_position=='left')
                accounting.settings.currency.format = "%s%v";
        else if (p3d.currency_position=='left_space')
                accounting.settings.currency.format = "%s %v";
        else if (p3d.currency_position=='right')
                accounting.settings.currency.format = "%v%s";
        else if (p3d.currency_position=='right_space')
                accounting.settings.currency.format = "%v %s";

        var unit_price_value = price;
        var total_price_value = unit_price_value * qty_value;
        var html_unit_price = motqnFormatCurrency(unit_price_value);
        var html_total_price = motqnFormatCurrency(total_price_value);

        p3d.analyse_queue[file_id].html_price_unit = html_unit_price;
        p3d.analyse_queue[file_id].html_price_total = html_total_price;
        p3d.analyse_queue[file_id].html_price = html_total_price; //todo bulk price update
        p3d.analyse_queue[file_id].price = unit_price_value;
        p3d.analyse_queue[file_id].total_price = total_price_value;
        p3d.analyse_queue[file_id].qty = qty_value;

        var $priceContainer = jQuery(obj).find('.plupload_file_price');
        $priceContainer.find('.plupload_file_price-tag--unit .plupload_file_price-tag-value').text(html_unit_price);
        $priceContainer.find('.plupload_file_price-tag--total .plupload_file_price-tag-value').text(html_total_price);
}

function p3dSubmitFormBulk() {
	var any_error = false;
	var email_address = jQuery('#p3d-email-address').val();
	var the_form = '<form action="" method="post">';
	the_form += '<input type="hidden" name="p3d_action" value="bulk_submit">';
	
	jQuery.each(Object.values(p3d.analyse_queue), function( index, value ) {
		var file_id = value.id;
		var obj = jQuery('li#'+file_id);
		var printer_id = jQuery(obj).find('select[name=product_printer]').val()
	       	var material_id = jQuery(obj).find('select[name=product_filament]').val();
		var infill = jQuery(obj).find('select[name=product_infill]').val();
		var infill_id = jQuery(obj).find('select[name=product_infill] option:checked').data('infill-id');
	       	var coating_id = jQuery(obj).find('select[name=product_coating]').val();
	       	var postprocessing_id = jQuery(obj).find('select[name=product_postprocessing]').val();
		var unit = jQuery(obj).find('select[name=product_unit]').val();
		var qty = jQuery(obj).find('.plupload_file_qty input').val();
		var comments = jQuery(obj).find('textarea.p3d-bulk-comments').val();
		var cutting_instructions = '';
		jQuery(obj).find('select[name^=p3d_cutting_instructions]').each(function(i, select_obj) {
			var start = jQuery(select_obj).prop('name').indexOf('[')+2;
			var end = jQuery(select_obj).prop('name').indexOf(']')-1;
			var obj_color = jQuery(select_obj).prop('name').substring(start, end);
			var obj_instruction = jQuery(select_obj).val();
			cutting_instructions+=obj_color+'='+obj_instruction+',';
		});


		jQuery(obj).find('select[name^=attribute_pa]').each(function(i, select_obj) {
			var attribute_name = jQuery(select_obj).data('id');
			var attribute_value = jQuery(select_obj).val();
			the_form += '<input type="hidden" name="p3d_custom_attributes['+file_id+']['+attribute_name+']" value="'+attribute_value+'">';
		});


		if (p3dGetCurrentCurrency()) {
			the_form += '<input type="hidden" name="p3d_estimated_price_currency" value="'+p3dGetCurrentCurrency()+'">';
		}
		else {
			the_form += '<input type="hidden" name="p3d_estimated_price_currency" value="">';
		}

		the_form += '<input type="hidden" name="p3d_files['+file_id+']" value="'+value.server_name+'">';
		the_form += '<input type="hidden" name="p3d_original_names['+file_id+']" value="'+value.name+'">';
		the_form += '<input type="hidden" name="p3d_prices['+file_id+']" value="'+value.price+'">';
		the_form += '<input type="hidden" name="p3d_printers['+file_id+']" value="'+printer_id+'">';
		the_form += '<input type="hidden" name="p3d_materials['+file_id+']" value="'+material_id+'">';
		the_form += '<input type="hidden" name="p3d_coatings['+file_id+']" value="'+coating_id+'">';
		the_form += '<input type="hidden" name="p3d_infills['+file_id+']" value="'+infill+'">';
		the_form += '<input type="hidden" name="p3d_infill_ids['+file_id+']" value="'+infill_id+'">';
		the_form += '<input type="hidden" name="p3d_postprocessings['+file_id+']" value="'+postprocessing_id+'">';
		the_form += '<input type="hidden" name="p3d_units['+file_id+']" value="'+unit+'">';
		the_form += '<input type="hidden" name="p3d_quantities['+file_id+']" value="'+qty+'">';
		the_form += '<input type="hidden" name="p3d_cutting_instructions['+file_id+']" value="'+cutting_instructions+'">';
		the_form += '<input type="hidden" name="p3d_comments['+file_id+']" value="'+comments+'">';
		the_form += '<input type="hidden" name="p3d_dims_x['+file_id+']" value="'+p3d.analyse_queue[file_id].dim_x+'">';
		the_form += '<input type="hidden" name="p3d_dims_y['+file_id+']" value="'+p3d.analyse_queue[file_id].dim_y+'">';
		the_form += '<input type="hidden" name="p3d_dims_z['+file_id+']" value="'+p3d.analyse_queue[file_id].dim_z+'">';


		if (typeof(value.new_pricing)!='undefined' && value.new_pricing) {
			any_error = true;
			the_form += '<input type="hidden" name="p3d_new_pricings['+file_id+']" value="'+value.new_pricing+'">';
		}
		if (parseFloat(value.price)==0) {
			any_error = true;
		}

	});
	if (any_error || p3d.pricing!='checkout') {
		if (email_address.length==0) {
			jQuery('#p3d-email-address-wrapper').show();
			alert(p3d.text_bulk_email);
			return false;
		}
	}

	the_form += '<input type="hidden" name="p3d_mode" value="'+p3d.pricing+'">';
	the_form += '<input type="hidden" name="p3d_product_id" value="'+jQuery('#p3d-product-id').val()+'">';
	the_form += '<input type="hidden" name="p3d_email_address" value="'+email_address+'">';
	the_form += '</form>';

	jQuery(the_form).appendTo('body').submit();
}

function p3dCheckAllFinished() {
	if (p3d.all_finished) {
		jQuery('.p3d-button-loader').hide();
		jQuery('#p3d-submit-button').prop('disabled', false);
		jQuery('#p3d-submit-button').show();
		jQuery('#p3d-bulk-uploader_browse').show();
		jQuery('.p3d-stats-bulk').find('select').prop('disabled', false);
	}
	else {
		jQuery('.p3d-button-loader').show();
		jQuery('#p3d-submit-button').prop('disabled', true);
		//jQuery('#p3d-submit-button').hide();
		jQuery('#p3d-bulk-uploader_browse').hide();
		jQuery('.p3d-stats-bulk').find('select').prop('disabled', true);
	}
}



jQuery(document).ready(function(){
	p3dInitBulk();
})


