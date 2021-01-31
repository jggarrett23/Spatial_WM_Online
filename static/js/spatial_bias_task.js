/* Spatial Working Memory Task script

author: Jordan Garrett
contact: jordangarrett@ucsb.edu
*/

/* 
Analysis ideas: Look at shortest path taken from random to true location? Confidence?
Estimation different when using different responses?
*/


//GLOBAL VARIABLES
//----------------------------------------------------------------------------------------------------

//in total there are 22 total combinations 
//440 will give us 20 trials per location combination. 150 = about 27 minutes
const num_trials = jatos.componentJsonInput.num_trials; 

var num_blocks = jatos.componentJsonInput.num_blocks; //change to 10

if (num_trials%num_blocks) {
	throw new Error('NUMBER OF TRIALS NOT EVEN ACROSS BLOCKS')
}

var num_practice_blocks = 1

var num_pracTrials = 22

//(0,45,90,135,180,225,270,315) use for 8 location bins

const location_binAngles = new Array(0,60,120,180,240,300); //angles the empty circles are drawn in

const set_sizes = new Array(1,2,6); //only looking at spatial bias now so really only need set sizes 2 & 4

// generate all possible combinations of locations for this set sizes
var set_locCombs = new Array() 

set_sizes.forEach(N => set_locCombs.push(k_combinations(location_binAngles,N)))

set_locCombs = set_locCombs.flat()

// number of trials per combination of stimulus locations. Since we want a confusion matrix, need to ensure equal number of trials per combination
var n_trials_perComb = num_trials/set_locCombs.length

//size of canvas we are presenting on
const canv_width = $(window).width();
const canv_height = $(window).height();

//for mouse down, up, and moving events
var clicking = false;

// radius of circle stimuli will appear around
const canv_radius = 200;

const stim_radius = 39.76;

// size of the stimulus in degrees
const stim_angSize = Math.acos(((2*Math.pow(canv_radius,2))-Math.pow(stim_radius,2))/(2*Math.pow(canv_radius,2)))*(180/Math.PI)

// minimum buffer of empty space between stimuli
const stim_buffer = stim_angSize + 30

//Custom JQuery and Global functions
//----------------------------------------------------------------------------------------------------
//jquery functions for objects
jQuery.fn.center = function () {
	this.css({'position':'absolute',
		'left':'50%',
		'top':'50%',
		'transform':'translate(-50%, -50%)'
	});
	return this;
}

jQuery.fn.rotate = function(degrees) {
	$(this).css({'-webkit-transform' : 'rotate('+ degrees +'deg)',
		'-moz-transform' : 'rotate('+ degrees +'deg)',
		'-ms-transform' : 'rotate('+ degrees +'deg)',
		'transform' : 'rotate('+ degrees +'deg)',
		'transform-origin' : 'center left'});
	return $(this);
};

jQuery.fn.getAngle = function(){

	var el = $(this)[0];
	var st = window.getComputedStyle(el, null);
	var tr = st.getPropertyValue("-webkit-transform") ||
	st.getPropertyValue("-moz-transform") ||
	st.getPropertyValue("-ms-transform") ||
	st.getPropertyValue("-o-transform") ||
	st.getPropertyValue("transform") ||
	"FAIL";

  
  	var values = tr.split('(')[1].split(')')[0].split(',');
  	var a = values[0];
  	var b = values[1];
  	var c = values[2];
  	var d = values[3];

  	var scale = Math.sqrt(a*a + b*b);

  	

  	// arc sin, convert from radians to degrees, round
  	var sin = b/scale;

  	// next line works for 30deg but not 130deg (returns 50);
  	// var angle = Math.round(Math.asin(sin) * (180/Math.PI));
 	var angle = Math.round(Math.atan2(b, a) * (180/Math.PI));

  	//console.log('Rotate: ' + angle + 'deg');
  	return angle
}

function shuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function permute( a, p ) {
	var r = [];
	for (var i = 0; i < a.length; ++i) {
		r.push(a[p[i]]);
	}
	return r;
}


// general function we can use to generate all possible combinations of size k for an array
function k_combinations(set, k) {
	var i, j, combs, head, tailcombs;
	
	// There is no way to take e.g. sets of 5 elements from
	// a set of 4.
	if (k > set.length || k <= 0) {
		return [];
	}
	
	// K-sized set has only one K-sized subset.
	if (k == set.length) {
		return [set];
	}
	
	// There is N 1-sized subsets in a N-sized set.
	if (k == 1) {
		combs = [];
		for (i = 0; i < set.length; i++) {
			combs.push([set[i]]);
		}
		return combs;
	}

	combs = [];
	for (i = 0; i < set.length - k + 1; i++) {
		// head is a list that includes only our current element.
		head = set.slice(i, i + 1);
		// We take smaller combinations from the subsequent elements
		tailcombs = k_combinations(set.slice(i + 1), k - 1);
		// For each (k-1)-combination we join it with the current
		// and store it to the set of k-combinations.
		for (j = 0; j < tailcombs.length; j++) {
			combs.push(head.concat(tailcombs[j]));
		}
	}
	return combs;
}


//use when wanting to draw something new
function create_canvas() {

	//clear out old stuff. not using .empty() to keep the image of the custom cursor
	$('div').remove()
	$('canvas').remove()
	$('button').remove()
	
	//bring cursor to front 
	$('#cursor').css('z-index',9999)

	$('body').css({'background-color':'DarkGray'})
	var canvas_html = "<canvas id='expcanvas' width="+canv_width+" height="+canv_height+" style='border:0px solid DarkSlateGrey'></canvas>";
	$('body').append(canvas_html)
	$('#expcanvas').css({'background-color':'DarkGray',
		'position':'absolute','top':'0','bottom':'0','left':'0','right':'0',
		'margin':'auto'});
	$('body').append('<div id="canv_container"> </div>')
	$('#canv_container').css({'position':'absolute','top':'50%','left':'50%',
		'transform': 'translate(-50%, -50%)','width':canv_width+'px','height':canv_height + 'px',
		'text-align':'center'});

	// custom cursor
	var x, y, px, py 
    px = py = 0 

	/* 
	mutex is used to avoid multiple click event from 
    firing at the same time due to different position 
    of image cursor and actual cursor  
    Using mutex avoid any conflicts if original cursor and 
    image cursor are both on a clickable element 
    This makes sure only 1 click event is triggered at a time
    */
	var mutex = false; 

	window.addEventListener("mouseup", function(e) { 
	    // gets the object on image cursor position 
	    var tmp = document.elementFromPoint(x + px, y + py);  
	    mutex = true 
	    tmp.click() 
	    $('#cursor').css({'left':(px + x) + "px", 
	    	'top': (py + y) + "px"})
    }) 

    /* The following event listener moves the image pointer  
    with respect to the actual mouse cursor 
    The function is triggered every time mouse is moved */
    window.addEventListener("mousemove", function(e) { 
  
		// Gets the x,y position of the mouse cursor 
		    x = e.clientX 
	        y = e.clientY 

	        // sets the image cursor to new relative position 
	        $('#cursor').css({'left':(px + x) + "px", 
	        	'top': (py + y) + "px"})
  
        }); 
  

	//quit button
	$('body').append('<button id="quit">Quit</button>')
	$('#quit').css({'background-color': 'DarkGray',
		'border': 'none',
		'text-align': 'center',
		'position':'fixed','right':'60px','bottom':'20px',
		'color':'red',
		'font-family':'Arial', 
		'font-size': (1.334*22)+'px'})
	$('#quit').click((event) => {

		//check if we have created the spatial task object
		if (typeof spatial_task != 'undefined'){
			
			//check if there is data logged
			if (typeof spatial_task.data_recorder != 'undefined' && 
				spatial_task.data_recorder['Trial'].length != 0 && 
				spatial_task.practice != 0){

				var all_trialData = JSON.stringify(spatial_task.data_recorder, null, '\t')
  				jatos.endStudy(all_trialData,false,'Sj ended study before completing all trials')
			} else {
				jatos.abortStudy()
			}
		} else {
			jatos.endStudy(false,'Sj ended study before completing any trials')
		}
	})

}

//Clear canvas
function clear_canvas(){
  //clear canvas after stimulus displayed
  var context = $('#expcanvas')[0].getContext('2d')
  var canvas_width = $('#expcanvas')[0].width;
  var canvas_height = $('#expcanvas')[0].height;
  context.clearRect(0,0,canvas_width,canvas_height);

  //clear lines in div elements
  var children = $('#canv_container')[0].children
  while (children.length > 1){
  	for (let child of children){
  		let id = child.id;
  		if (id.includes('line')){
  			$('#'+id).remove();
  		}   
  	}
  }

}

// displays some text on the first screen
function welcome() {
	let text1 = `Welcome to Part 2 of this psychology experiment!\n\n`
	let text2 = `Press the button to continue.`;
	var welcome_text = text1.fontsize(5).bold() + text2.fontsize(4)

	$('#canv_container').append('<p id=text></p>');
	$('#canv_container').append('<button id="continue">Continue</button>');
	$('#text').html(welcome_text)
	$('#text').center()
	$('#text').css({'width':'85%', 'white-space':'pre-wrap', 'text-align':'center'})
	$('#continue').center()
	$('#continue').css({'top':'60%','font-size':'20px'})
	$('#continue').click(function(){
		if (document.documentElement.requestFullscreen){
			document.documentElement.requestFullscreen();
		} else if (document.documentElement.mozRequestFullScreen){
			document.documentElement.mozRequestFullScreen();
		} else if (document.documentElement.webkitRequestFullscreen){
			document.documentElement.webkitRequestFullscreen();
		} else if (document.documentElement.msRequestFullscreen){
			document.documentElement.msRequestFullscreen();
		}
		next_main_trialState()});
}

// Tells the participants how to complete the experiment
function overall_instructions() {
	let text1 = 
	`
	This experiment is a test of your working memory abilities.\n
	The entire experiment should take about 65 minutes.\n
	Please do your best to complete all of the trials.\n`

	let text2 = 
	`
	<b>DO NOT</b> refresh this page as it will clear your progress and your data will not be saved.\n
	If you'd like to stop during the experiment hit the lower right `
	
	let text3 = `QUIT ` 

	let text4 = `button at any time.\n\n If you have technical issues, please contact ` 
	
	let text5 = `jordangarrett@ucsb.edu ` 

	let text6 = `to receive partial compensation.\n\nTo view instructions for the task, click continue below.`

	var instruct_text = text1 + text2 + text3.fontcolor('red').bold() + text4 + 
						text5.fontcolor('blue').bold() + text6

	$('#canv_container').append('<p id=text></p>');
	$('#canv_container').append('<button id="continue">Continue</button>');
	$('#text').html(instruct_text.fontsize(5))
	$('#text').center()
	$('#text').css({'width':'85%', 'white-space':'pre-wrap','top':'40%', 'left':'48%',
					'text-align':'center'})
	$('#continue').center()
	$('#continue').css({'top':'75%', 'font-size':'20px'})
	//$('#continue').click(next_main_trialState);
	$('#continue').click((event) => {
		$('body').addClass('stop-scrolling')
		next_main_trialState()
	})
}

function end_experiment(task_object) {
	var end_exp_text = 
	`Thank you for completing this experiment.\n
	Hitting the button below will end the experiment.`;

	$('#canv_container').append('<p id=text></p>');
	$('#canv_container').append('<button id="continue">Continue</button>');
	$('#text').html(end_exp_text.fontsize(6))
	$('#text').center()
	$('#text').css({'width':'85%', 'white-space':'pre-wrap'})
	$('#continue').center()
	$('#continue').css({'top':'65%','font-size':'20px'})
	$('#continue').click((event) => {

		// dont save data on practice trials
		if (task_object.practice == 0){
			var all_trialData = JSON.stringify(task_object.data_recorder, null, '\t')
	  		jatos.endStudy(all_trialData, true, 'Spatial Precision Task Completed, Data Submitted')
		}
  	
  	});
}


//Response Helper functions ---------------------------------------------------------------------
function drawTest_Stim (test_context,test_locationsX,test_locationsY,mouseX,mouseY,clicked_Locs){
    //use distance formula sqrt((x2 - x2)^2 + (y2-y1)^2)
    var stimBounds_X = test_locationsX.map(function(x){
    	return Math.pow(x - mouseX,2)
    })

    var stimBound_Y = test_locationsY.map(function(y){
    	return Math.pow(y - mouseY,2)
    })

    var dist = stimBounds_X.map(function (x,idx){
    	return Math.sqrt(x + stimBound_Y[idx]);
    })

    var clickedLoc_idx = []; var new_angle = [];

    // if minimum distance from location less than stimulus radius
    if ( Math.min.apply(Math,dist) <= stim_radius ){

      //get location associated with mouse click
      var clickedLoc_idx = dist.indexOf(Math.min(...dist));

      let clickedLoc_X = test_locationsX[clickedLoc_idx];

      let clickedLoc_Y = test_locationsY[clickedLoc_idx];

      $('#canv_container').append('<div id="probe_line'+clickedLoc_idx+'" horizontal layout></div>')

      $("#probe_line"+clickedLoc_idx).css({'position':'absolute','top': clickedLoc_Y, 'left': clickedLoc_X , 'height': '5px', 'width': stim_radius + 1.3 + 'px',
      	'background-color': 'black','border': '0px solid black','outline-style':'none',
      	'box-shadow':'none'})

      $("#probe_line"+clickedLoc_idx).attr('tabindex', '0')

      //rotate probe line to random angle
      let test_angle = Math.floor(Math.random() * (360 - 0 + 1)) + 0;

      $("#probe_line"+clickedLoc_idx).rotate(test_angle)

      if (!clicked_Locs.includes(clickedLoc_idx)){
      	test_context.beginPath()
      	test_context.strokeStyle = 'black';
      	test_context.fillStyle = 'DarkGray';
      	test_context.lineWidth = 8;
      	test_context.arc(clickedLoc_X,clickedLoc_Y,stim_radius, 0, 2*Math.PI)
      	test_context.stroke()
      	test_context.fill()
      }
      
      new_angle = mouseRotate_probeLine(clickedLoc_idx)

      // if probe angles were not changed, set response angle equal to probe angle
      if (!Array.isArray(new_angle) || !new_angle.length){
      	new_angle = test_angle;
      } 
  }

  return [clickedLoc_idx, new_angle]

} 

function mouseRotate_probeLine(clicked_loc){
	var rect = $('#canv_container')[0].getBoundingClientRect();

	var probeX = $("#probe_line"+clicked_loc).position().left
	var probeY = $("#probe_line"+clicked_loc).position().top

	var rotate_deg = [];

    //use to continuosly get mouse position after mouse down
    $('#canv_container').mousemove(function(event){
    	if (clicking==false) return;

    	var mouseX = event.clientX - rect.left;
    	var mouseY = event.clientY - rect.top;

      //set tolerance for how close mouse must be for rotation
      let x_diff = Math.pow((mouseX-probeX),2);
      let y_diff = Math.pow((mouseY-probeY),2);
      let dist = Math.sqrt(y_diff + x_diff);

      if (dist > stim_radius + 16) return;

      let rotate_rad = Math.atan2(mouseY-probeY,mouseX-probeX)
      rotate_deg = rotate_rad * 180 / Math.PI;

      $("#probe_line"+clicked_loc).rotate(rotate_deg)
      
  });
    return rotate_deg
}

function keyRotate(test_locationsX,test_locationsY,mouseX,mouseY){
	var stimBounds_X = test_locationsX.map(function(x){
		return Math.pow(x - mouseX,2)
	})

	var stimBound_Y = test_locationsY.map(function(y){
		return Math.pow(y - mouseY,2)
	})

	var dist = stimBounds_X.map(function (x,idx){
		return Math.sqrt(x + stimBound_Y[idx]);
	})

	var probe_angle = []; var clickedLoc_idx = []

	if (Math.min.apply(Math,dist) <= stim_radius ){
		var clickedLoc_idx = dist.indexOf(Math.min(...dist));

		$('#probe_line'+clickedLoc_idx).focus()
		$('#probe_line'+clickedLoc_idx).get().hideFocus = true

		var probe_angle = $("#probe_line"+clickedLoc_idx).getAngle();

		let delta; 
		$('#probe_line'+clickedLoc_idx).keydown(function(event){
			var keyCode = event.keyCode;

			if (event.shiftKey){
				delta = 2;
			} else{
				delta = 20;
			}

			switch (keyCode){
          //right arrow
          case 39: 
          probe_angle += delta
          $('#probe_line'+clickedLoc_idx).rotate(probe_angle)
          break;
        //left arrow
        case 37:
        probe_angle -= delta
        $('#probe_line'+clickedLoc_idx).rotate(probe_angle)
        break;

    }

})
		return [clickedLoc_idx, probe_angle]
	}

}

//----------------------------------------------------------------------------------------------------
//Task Creation
class Spatial_Task{
	constructor(nTrials,set_sizes,practice){
		this.nTrials = nTrials-1; //java is a zero index language?
		this.set_sizes = set_sizes;
		this.current_trial = 0;
		this.trial_state = 0;
		this.practice = practice //use to determine if they are completing a practice portion or not so we dont save those trials
	    this.stim_radius = 39.76; //? stimulus square size px
	    this.stim_present = 250; // present stimulus for 250 ms 
	    this.stim_isi = 1750;
	    this.trials_per_block = nTrials / num_blocks

	    var stim_locs = this.generate_locations();

	    var all_locations = stim_locs[0].flat();
	    var all_sampleProbeAngles = stim_locs[1].flat();
	    var all_setSizes = stim_locs[2].flat();
	    var all_sampX_coor = stim_locs[3].flat();
	    var all_sampY_coor = stim_locs[4].flat();
	    var all_samp_locNum = stim_locs[5].flat();
	    var all_samp_locBin = stim_locs[6].flat();

	    var perm_idx = shuffle(_.range(this.nTrials+1))

	    this.trialLocations = permute(all_locations,perm_idx);
	    this.trialSampProbeAngs = permute(all_sampleProbeAngles,perm_idx);
	    this.trialSetSizes = permute(all_setSizes,perm_idx)
	    this.trialSampleLocX = permute(all_sampX_coor,perm_idx);
	    this.trialSampleLocY = permute(all_sampY_coor,perm_idx);
	    this.trialSampleLocNumb = permute(all_samp_locNum,perm_idx);
	    this.trialSampleLocBin = permute(all_samp_locBin,perm_idx);

	    
	    if (practice != 1){
	    	var blocks_idx = new Array()
		    for (let iBlock = 0; iBlock < num_blocks; iBlock++){
		    	blocks_idx.push(Array(this.trials_per_block).fill(iBlock+1))
		    }
		    blocks_idx = blocks_idx.flat()

		    trial_idx = new Array(num_blocks)
	    					.fill([...Array(this.trials_per_block).keys()])
	    					.flat()
	    					.map(function(num){return num+1})

		} else {
			var blocks_idx = new Array(num_pracTrials).fill(num_practice_blocks)
			var trial_idx = new Array(num_practice_blocks).fill([...Array(num_pracTrials).keys()]).flat().map(function(num){return num+1})
	    }
	    

	    // trials block number
	    this.block_num = blocks_idx
	    // trials number within the block
	    this.trial_idx = trial_idx
    
		// initialize an empty dict for recording data
		this.data_recorder = {
			'Block': new Array(),
			'Trial': new Array(),
			'SetSize': new Array(),
			'SampleLocNumb': new Array(),
			'SampleLocBin': new Array(),
			'SampleLocationAngles': new Array (),
			'SampleLocX': new Array(),
			'SampleLocY': new Array(),
			'SampleProbeAngles': new Array(),
			'RespLocNumb': new Array(),
			'RespLocationAngles': new Array(), 
			'RespProbeAngles': new Array(),
			'RespOrder': new Array()
		}


		this.allTrial_states = [
			() => {this.block_message(this.block_num[this.current_trial])},
			() => {this.display_fixation()},
			() => {this.start_trial()},
			() => {this.make_stimuli()},
			() => {this.display_fixation(this.stim_isi)},
			() => {this.gen_test_array()}
		];
	

	    //this will be for starting the task, put the task instructions here
	    this.start = () => {
	    	this.startTime = Date.now();

	    	if (this.practice == 1){
	    		this.task_instructions();
	    	} else {
	    		this.task_main()

	    	}
	    	
	    	this.endTime = Date.now();
	    }


	    this.nextTrialState = () => {
	    	create_canvas()

	      	// if the next state exists, do it
	      	if (this.allTrial_states[this.trial_state]){

	      		if (this.trial_idx[this.current_trial] != 1 && this.trial_state == 0){
	      			this.trial_state++
	      			this.allTrial_states[this.trial_state]()
	      			this.trial_state++
	      		} else {
	      			this.allTrial_states[this.trial_state]()
	      			this.trial_state++
	      		}
      				
	      	} else {

	      		if (this.current_trial >= this.nTrials){
	      			next_main_trialState();
	      		} else {
		      		this.current_trial ++
		      		this.trial_state = 0;
		      		this.nextTrialState()
	      		}
	      	}
  		}

	  	this.start_trial = () => {
	      var fix_radius = 6.18; //?

	      var x_center = $('#canv_container').width()/2;
	      var y_center = $('#canv_container').height()/2;

	      var context = $('#expcanvas').get(0).getContext('2d');
	      context.beginPath()
	      context.arc(x_center,y_center,fix_radius,0,2*Math.PI);
	      context.fillStyle = 'blue';
	      context.strokeStyle = 'blue';
	      context.stroke()
	      context.fill()

	      $(document).keydown((event)=> {
	      	if(event.keyCode==32){
	      		$(document).off('keydown')
	      		$(document).unbind('keydown')
	      		this.nextTrialState()
	      	} 
	      })
	  	}		

	}


	display_fixation (duration=0) {

		$('#cursor').hide()

	    var fix_radius = 6.18; //?

	    var x_center = $('#canv_container').width()/2;
	    var y_center = $('#canv_container').height()/2;

	    var context = $('#expcanvas').get(0).getContext('2d');
	    context.beginPath()
	    context.arc(x_center,y_center,fix_radius,0,2*Math.PI);
	    context.fillStyle = 'blue';
	    context.strokeStyle = 'blue';
	    context.stroke()
	    context.fill()

	    //waits necessary time
	    var called = performance.now()
	    var timeout = setTimeout(() => {
	    	this.nextTrialState();
	    	this.sample_time = performance.now() - called}, duration)
	    
	}


	generate_locations(){

		var all_locations = new Array()
		var all_sampleProbeAngles = new Array()
		var all_setSizes = new Array ()
		var all_sampleLocX = new Array ()
		var all_sampleLocY = new Array ()
		var all_sampleLocNums = new Array ()
		var all_sampleLocBins = new Array ()

		var x = canv_width/2;
		var y = canv_height/2;

		//this way participants see all possible combinations during the practice phase
		if(this.practice == 1){
			n_trials_perComb = 1
		}


	    //first loop through each location combination
	    for (let iComb = 0; iComb < set_locCombs.length; iComb++ ){

	    	let loc_comb = set_locCombs[iComb]

	    	var temp_locAngles = new Array(); 
	    	var temp_locBinAng = new Array();
	    	var temp_probeAngles = new Array();

	    	var temp_locX = new Array();
	    	var temp_locY = new Array();
	    	var temp_locNum = new Array();

	    	for (let iTrial = 0; iTrial < n_trials_perComb; iTrial++){

	    		let tempTrial_locAngles = new Array(); 
		      	var tempTrial_probeAngles = new Array();

		      	var tempTrial_locX = new Array();
		      	var tempTrial_locY = new Array();

		      	var tempTrial_locNumb = new Array();

		      	// use this to keep track of the bin that the stimulus appears in 
		      	var tempTrial_locBinAng = new Array();

	    		for (let iSamp = 0; iSamp < loc_comb.length; iSamp++){

	    			let samp_bin = loc_comb[iSamp] // we want the stimulus to appear between this bin boundary and the next which is 60 degrees away

	    			let max_ang = Math.floor(samp_bin+60-(stim_buffer/2))
    				let min_ang = Math.floor(samp_bin + (stim_buffer/2))

    				let samp_angle = Math.floor(Math.random() * (max_ang - min_ang)) + min_ang //should generate random angle between bin boundaries
    			
		         	// ensure that samples do not overlap with one another
	    			for (let iPrevSamp in tempTrial_locAngles){
	    				let prev_sampAng = tempTrial_locAngles[iPrevSamp];
	    				let ang_diff = prev_sampAng - samp_angle //calculate difference between new angle and previous ones
	    				let new_minAng
	    				if (Math.abs(ang_diff) < stim_buffer){

	    					// compute the angle that satisfies minimum distance from previous samples
	    					if(ang_diff < 1){
	    						new_minAng = samp_angle + (stim_buffer+ang_diff)
	    					} else{
	    						new_minAng = samp_angle - (stim_buffer-ang_diff)
	    					}

	    					// checking for errors
	    					if(new_minAng > samp_bin+60 || new_minAng < samp_bin){
	    						console.log('Problem')
	    					}
	    					// generate random sample angle that is at least minimum distance away from previous sample
	    					if (ang_diff < 1){
	    						
	    						//angle needs to be larger
	    						samp_angle = Math.floor(Math.random()*((samp_bin+60) - new_minAng+1)) + new_minAng
	    					} else {
	    						//angle needs to be smaller
	    						samp_angle = Math.floor(Math.random()*(new_minAng - samp_bin+1)) + samp_bin

	    					}
	    				}
	    				
	    			}

	    			//calculate x and y coordinates of location
		          	let dx = canv_radius * Math.cos(-samp_angle*Math.PI/180);
		          	let dy = canv_radius * Math.sin(-samp_angle*Math.PI/180);

		          	let new_x = x + dx;
		         	let new_y = y + dy;


	    			tempTrial_locAngles.push(samp_angle);
	    			tempTrial_locX.push(new_x);
		          	tempTrial_locY.push(new_y);
		          	tempTrial_locNumb.push(iSamp);

		          	//generate random probe (black line) angles
		          	let probe_angle = Math.floor(Math.random() * (360 - 0 + 1)) + 0;
		          	tempTrial_probeAngles.push(probe_angle);


		          	tempTrial_locBinAng.push(samp_bin);

	    		}

		      	temp_locAngles.push(tempTrial_locAngles);
		      	temp_probeAngles.push(tempTrial_probeAngles);
		      	temp_locX.push(tempTrial_locX);
		      	temp_locY.push(tempTrial_locY);
		      	temp_locNum.push(tempTrial_locNumb);
		     	all_setSizes.push(loc_comb.length);

		     	temp_locBinAng.push(tempTrial_locBinAng);

			}

		  	all_locations.push(temp_locAngles);
	  	    all_sampleLocX.push(temp_locX);
		  	all_sampleLocY.push(temp_locY);
		  	all_sampleProbeAngles.push(temp_probeAngles);
		  	all_sampleLocNums.push(temp_locNum);

		  	all_sampleLocBins.push(temp_locBinAng);
		   
			
		}

		return [all_locations,all_sampleProbeAngles,all_setSizes,all_sampleLocX,all_sampleLocY,all_sampleLocNums,all_sampleLocBins]
	}


	make_stimuli (){

	    //current trial locations
	    var current_trialLocations = this.trialLocations[this.current_trial]
	    var current_trialAngles = this.trialSampProbeAngs[this.current_trial]
	    var current_trialsampX = this.trialSampleLocX[this.current_trial]
	    var current_trialsampY = this.trialSampleLocY[this.current_trial]

	    var samp_idx = new Array()
	    for(var iSamp = 0; iSamp < current_trialLocations.length; iSamp ++ ){
	      //create stimulus
	      var circ = $('#expcanvas').get(0).getContext('2d');
	      circ.strokeStyle = 'black';

	      let new_x = current_trialsampX[iSamp];
	      let new_y = current_trialsampY[iSamp];

	      circ.beginPath()
	      circ.fillStyle = 'DarkGray';

	      circ.lineWidth = 8;
	      circ.arc(new_x,new_y,this.stim_radius, 0, 2*Math.PI);

	      circ.stroke()
	      circ.fill()
	      
	      //draw probe line at angle between 0 & 360
	      let probe_angle = current_trialAngles[iSamp];

	      $('#canv_container').append('<div id="sampProbe_line'+iSamp+'" horizontal layout></div>')

	      $("#sampProbe_line"+iSamp).css({'position':'absolute','top': new_y, 'left': new_x , 'height': '5px', 'width': this.stim_radius + 1.3 + 'px',
	      	'background-color': 'black','border': '0px solid black'})

	      $("#sampProbe_line"+iSamp).rotate(probe_angle)

	  	} 

	    // waits the necessary amount of time
	    var called = performance.now()
	    var timeout = setTimeout(() => {
	    	this.nextTrialState();
	    	this.sample_time = performance.now() - called}, this.stim_present)

	}

	gen_test_array (){

		let fixX_center = $('#canv_container').width()/2
		let fixY_center = $('#canv_container').height()/2

		//randomize cursor position within the screen (random number between +/-205 px from fixation dot center)
		let cursor_delta = 205
		
		let cursor_x = Math.floor(Math.random() * ((fixX_center+cursor_delta) - (fixX_center-cursor_delta)+1)) + (fixX_center-cursor_delta)
		let cursor_y = Math.floor(Math.random() * ((fixY_center+cursor_delta) - (fixY_center-cursor_delta)+1)) + (fixY_center-cursor_delta)

		$('#cursor').css({'left': cursor_x + 'px','top': cursor_y + 'px'})

		$('#cursor').show()

	    var fix_radius = 6.18; //?

	    var x_center = $('#expcanvas').width()/2;
	    var y_center = $('#expcanvas').height()/2;

	    var context = $('#expcanvas').get(0).getContext('2d');
	    context.beginPath()
	    context.arc(x_center,y_center,fix_radius,0,2*Math.PI);
	    context.fillStyle = 'blue';
	    context.strokeStyle = 'blue';
	    context.stroke()
	    context.fill()

	    //take sample dict to generate sample stimuli
	    var stim_locs = this.trialLocations[this.current_trial]
	    
	    let num_locs = stim_locs.length;

	    var all_locsX = this.trialSampleLocX[this.current_trial]; 
	    var all_locsY = this.trialSampleLocY[this.current_trial];
	    
	    for(let i = 0; i < num_locs; i ++ ){

	      //create test cicle
	      var test_context = $('#expcanvas').get(0).getContext('2d');
	      test_context.beginPath();
	      test_context.strokeStyle = '#4D5151';

	      let x = all_locsX[i];
	      let y = all_locsY[i];

	      test_context.lineWidth = 2;
	      test_context.fillStyle = '#4D5151';
	      test_context.arc(x,y,this.stim_radius,0,2*Math.PI)

	      test_context.stroke()
	      test_context.fill()

	  	}

	  	//CHANGE DRAWING ON MOUSE CLICK
	  	var clicked_Locs = new Array(); 
	  	var clicked_locsAngles = {};
	  
	  	//store current trial repsones in dict
	  	var trial_responseAngles = {};
	  
	  	$('#canv_container').mousedown((event)=> {

	  		$('body').css('cursor', 'none')
		  	var rect = $('#canv_container')[0].getBoundingClientRect();
		  	var clickX = event.clientX - rect.left;
		  	var clickY = event.clientY - rect.top;

		    //turn on the mouse move function now
		    clicking = true

	    	var clicked_probe = drawTest_Stim(test_context,all_locsX,all_locsY,clickX,clickY,clicked_Locs)

		    if ((clicked_probe[0]+clicked_probe[1]) > 0){
		    	var clicked_probeLoc = clicked_probe[0];
		    	var response_angle = clicked_probe[1];

		    	trial_responseAngles[clicked_probeLoc] = response_angle;
		    	if (!clicked_Locs.includes(clicked_probeLoc)){
		    		clicked_Locs.push(clicked_probeLoc);
		    		clicked_locsAngles[clicked_probeLoc] = stim_locs[clicked_probeLoc]
		    	} 

	    	} 

		});

  		$('#canv_container').click((event)=>{
	  		var rect = $('#canv_container')[0].getBoundingClientRect();
	  		var clickX = event.clientX - rect.left;
	  		var clickY = event.clientY - rect.top;

  			var rotated_probe = keyRotate(all_locsX,all_locsY,clickX,clickY)
  			if (Array.isArray(rotated_probe)){
	  			var rotatedProbe_Loc = rotated_probe[0];
		  		var response_angle = rotated_probe[1];
	  			trial_responseAngles[rotatedProbe_Loc] = response_angle;
  			}

  		})

  		//turn off clicking if mouse up
  		$('body').mouseup((event)=>{
  			clicking = false
  		})

  		//press space after rotating probe stimuli 
  		$(document).keydown((event)=>{
  			if (event.keyCode == 32){

	  			//correct angles that are stored as values between -0 to -180
	  			for (var loc in trial_responseAngles) {

	  				trial_responseAngles[loc] = $("#probe_line"+loc).getAngle()

	  				if (trial_responseAngles[loc] < 0){
	  					trial_responseAngles[loc] = 360 + trial_responseAngles[loc]

	  				}
	  			}

  				let tempRespLocNumbs =  Object.keys(trial_responseAngles);
  				var responseLocNumbs = tempRespLocNumbs.map(function (x) { 
  					return parseInt(x, 10); 
  				});	

		      	// STORE DATA
		      	let trial_numb = this.current_trial

		      	//create dict for sample location angles to make saving nicer
		      	let Samp_ProbAngs = {}
		      	let current_sampAngs = this.trialSampProbeAngs[trial_numb]
		      	for (let iSamp = 0; iSamp < current_sampAngs.length; iSamp++){

		      		Samp_ProbAngs[iSamp] = current_sampAngs[iSamp]
		      	}


		      	this.data_recorder['Trial'].push(trial_numb)
		      	this.data_recorder['Block'].push(this.block_num[trial_numb])
		      	this.data_recorder['SetSize'].push(this.trialSetSizes[trial_numb])
		      	this.data_recorder['SampleLocNumb'].push(this.trialSampleLocNumb[trial_numb])
		      	this.data_recorder['SampleLocBin'].push(this.trialSampleLocBin[trial_numb])
		      	this.data_recorder['SampleLocationAngles'].push(this.trialLocations[trial_numb])
		      	this.data_recorder['SampleLocX'].push(this.trialSampleLocX[trial_numb])
		      	this.data_recorder['SampleLocY'].push(this.trialSampleLocY[trial_numb])
		      	this.data_recorder['SampleProbeAngles'].push(Samp_ProbAngs)
		      	this.data_recorder['RespLocNumb'].push(responseLocNumbs)
			  	this.data_recorder['RespLocationAngles'].push(clicked_locsAngles) //this should be same as SampleLocationAngles
			  	this.data_recorder['RespProbeAngles'].push(trial_responseAngles) //this is what we compare with SampleProbeAngles
			  	this.data_recorder['RespOrder'].push(clicked_Locs)

		      	this.nextTrialState()
		      	$(document).off('keydown')
		      	$(document).unbind('keydown')

  			}		 

		})


	} 

	task_instructions() {
		
		var task_instruct_text = `
		For this task you will be asked to remember the position of lines in a series of locations.\n
		First, to begin a trial press the <b>SPACEBAR</b>. Then, a blue circle will appear in the center of the screen.\n
		Please keep your gaze on the blue circle for the remainder of a trial.\n
		Next, empty circles containing black lines will appear around the center blue circle.\n
		<b>Do your best to remember the orientation of as many of these lines as possible.</b>\n
		After a short delay, the circles will appear in the same location, but now colored gray.\n
		Once you click on a circle, the grey overlay will disappear, once again showing the empty circle,\n
		but the black line is now at a random orientation.\n 
		Please rotate the black line back to its original orientation using one of two ways. First <b>CLICK</b> on the location and:\n

		(1) <b>HOLD DOWN your MOUSE to rotate the line</b>\n 
		or \n
		(2) <b>rotate the line using the ARROW KEYS. To rotate the line more slowly, use SHIFT + ARROW KEYS.</b>\n
		Once you have rotated the black lines to their original orientation, press <b>SPACE</b> to submit your answer.\n 
		Please be sure you understand these instructions. When you are ready to start, click the button below. Good luck!`; 
			
		$('#canv_container').append('<p id=text></p>');
		$('#canv_container').append('<button id="continue">Continue</button>');
		$('#text').html(task_instruct_text)
		$('#text').center()
		$('#text').css({'width':'85%', 'white-space':'pre-wrap','text-align':'center',
						'top':'43%', 'left':'48%', 'font-size':(1.334*16)+'px'})
		
		$('#continue').center()
		$('#continue').css({'top':'97%','left':'50%','font-size':'20px'})
		$('#continue').click((event) => {
			this.task_practice();
		});
	}


	task_practice(){

		create_canvas()
		var pratice_instruct = `
		You will now begin the practice phase.\n
		To start, click the button below.
		`

		$('#canv_container').append('<p id=text></p>')
		$('#canv_container').append('<button id="practice">Start Practice</button>')
		$('#text').text(pratice_instruct)
		$('#text').center()
		$('#text').css({'width':'85%', 'white-space':'pre-wrap','text-align':'center',
						'font-size':(1.334*20)+'px', 'left':'47%'})
		
		$('#practice').center()
		$('#practice').css({'top':'65%','left':'50%','font-size':'25px'})
		$('#practice').click((event) => {
			this.nextTrialState()
		});

	}

	task_main(){
		create_canvas() // clear old instructions

		var main_instruct = `
		You have fininshed the practice phase.\n
		Time to do the real experiment! \n
		To start, click the button below.
		`

		$('#canv_container').append('<p id=text></p>')
		$('#canv_container').append('<button id="main">Start Experiment</button>')
		$('#text').text(main_instruct)
		$('#text').center()
		$('#text').css({'width':'85%', 'white-space':'pre-wrap','text-align':'center',
						'font-size':(1.334*20)+'px', 'left':'47%'})
		
		$('#main').center()
		$('#main').css({'top':'70%','left':'50%','font-size':'25px'})
		$('#main').click((event) => {
			this.nextTrialState()
		});
	}


	block_message(block_number){

		create_canvas() // clear old instructions

		var block_text

		if (this.practice == 1){
			block_text = `Practice Block ` + block_number + ' of ' + num_practice_blocks
		} else {
			block_text = `Block ` + block_number + ' of ' + num_blocks
		}
		

		$('#canv_container').append('<p id=text></p>')
		$('#canv_container').append('<button id="block">Start Block</button>')
		$('#text').text(block_text)
		$('#text').center()
		$('#text').css({'width':'85%', 'white-space':'pre-wrap','text-align':'center',
						'font-size':(1.334*40)+'px', 'left':'50%', 'font-weight':'bold', 'top':'40%'})
		
		$('#block').center()
		$('#block').css({'top':'55%','left':'50%','font-size':'25px'})
		$('#block').click((event) => {
			this.nextTrialState()
		});
		
	}

		
}

//----------------------------------------------------------------------------------------------------
//Run Task
let do_practice = 1
var practice_spatialTask = new Spatial_Task(num_pracTrials,set_sizes,do_practice)

do_practice = 0
var spatial_task = new Spatial_Task(num_trials, set_sizes, do_practice);


//NEED TO DEFINE MAIN STATES
// The state machine for the entire experiment
var states = [
welcome,
overall_instructions,
practice_spatialTask.start,
spatial_task.start
];


var cur_main_state = 0;
function next_main_trialState () {
	create_canvas()

	if (states[cur_main_state]) {
		states[cur_main_state]()
	} else {
		end_experiment(spatial_task)
	}
	cur_main_state++
}


$(window).ready(function(){
	next_main_trialState()
});



