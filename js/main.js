var currentPosition = {
	lat: 0,
	lng: 0,
};

function initMap(){
	if(navigator.geolocation){
		// 如果可以抓地點
		navigator.geolocation.getCurrentPosition(function(position){
			// 透過 Google Maps 把經緯度轉成地址
			var geocoder = new google.maps.Geocoder();
			var coords = {
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			};
			currentPosition = coords;
			geocoder.geocode({latLng: coords}, function(result, status){
				if(status === google.maps.GeocoderStatus.OK){
					$('#position').text(result[0].formatted_address);
				}else{
					$('#position').text('無法定位');
				}
			});
			// $('#position').text(position.coords.latitude +',' + position.coords.longitude);
		});
	}else{
		$('#position').text('無法定位');
	}
}

$(function(){
	if(getParameterByName('RouteName') !== null){
		getBus(getParameterByName('RouteName'));
	}

	$('h1').on('click', function(){
		if($('#bus-list:hidden').length) history.back();
	});

	// 抓取公車路線資料
	$.ajax({
		url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/Route/City/Kaohsiung?$format=json',
		method: 'GET',
		success: function(result){
			// 公車路線資料排序
			result.sort(function(a, b){
				return a.RouteName.Zh_tw > b.RouteName.Zh_tw ? 1 : -1;
			});
			// Loading 藏起來
			$('ul.bus-list').html('');
			// 把每個路線資料加進 ul.bus-list 裡面
			Object.keys(result).forEach(function(i){
				var RouteName = result[i].RouteName.Zh_tw;
				RouteName = RouteName.replace(/(\(.*?\))/, '<small>$1</small>');
				$('ul.bus-list').append('<li data-routeid="'
				+ result[i].RouteID
				+'"><div class="ddesc">'
				+ result[i].SubRoutes[0].Headsign
				+ '</div><div class="route-name">'
				+ RouteName
				+ '</div></li>');
			});
			$('body').delegate('.bus-list li', 'click', function(){
				getBus($(this).find('.route-name').text());
			});
		}
	});

	// 篩選公車
	$('.search-route').on('input', function(){
		if($(this).val().trim() === ''){
			$('.bus-list li').show();
		}else{
			var searchText = $(this).val().trim();
			$('.bus-list li').hide();
			$('.bus-list li').filter(function(){
				return $($(this).find('.ddesc')).text().includes(searchText)
				|| $($(this).find('.route-name')).text().includes(searchText)
			}).show();
		}
	});

	// 上一頁的時候
	window.onpopstate = function(){
		if(this.history.state === null){
			$('section#bus-list').show();
			$('section#station-list').hide();
		}
	}
});

function getBus(routeName){
	$.ajax({
		url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/Route/City/Kaohsiung/' + routeName + '?$format=json',
		method: 'GET',
		success: function(result){
			result = result.filter(x => x.RouteName.Zh_tw === routeName);
			if(result[0].DestinationStopNameZh && result[0].DepartureStopNameZh){
				$('.direction-forth').html('<div>往' + result[0].DestinationStopNameZh + '</div>');
				$('.direction-back').html('<div>往' + result[0].DepartureStopNameZh + '</div>');
			}else{
				$('.direction-forth').html('<div>去程</div>');
				$('.direction-back').html('<div>返程</div>');
			}
			$('.direction-forth').on('click', function(){
				$('#station-list li').filter(function(){return $(this).data('direction') === 0}).show();
				$('#station-list li').filter(function(){return $(this).data('direction') === 1}).hide();
			});
			$('.direction-back').on('click', function(){
				$('#station-list li').filter(function(){return $(this).data('direction') === 0}).hide();
				$('#station-list li').filter(function(){return $(this).data('direction') === 1}).show();
			});
		}
	});

	// 隱藏大 section
	$('section#bus-list').hide();
	$('section#station-list').show();

	$('ul.station-list').html('');
	$('section#station-list').find('h2').html('<i class="fa fa-bus"></i> ' + routeName);

	// 取得所有站牌
	$.ajax({
		url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/StopOfRoute/City/Kaohsiung/' + routeName + '?$format=json',
		method: 'GET',
		dataType: 'json',
		success: function(data){
			if(data.length === 0){
				location.href = './'
				return;
			}
			data = data.filter(x => x.RouteName.Zh_tw === routeName);
			var stops = [];
			Object.keys(data).forEach((i) => {
				var nearestStation;
				var nearestDistance = 999999999;
				Object.keys(data[i].Stops).forEach((j) => {
					var a = {};
					a.name = data[i].Stops[j].StopName.Zh_tw;
					a.position = {
						lat: data[i].Stops[j].StopPosition.PositionLat,
						lng: data[i].Stops[j].StopPosition.PositionLon,
					};
					a.StopUID = data[i].Stops[j].StopUID;
					if(distanceLatlng(currentPosition, a.position) <= nearestDistance){
						nearestDistance = distanceLatlng(currentPosition, a.position);
						nearestPosition = a.StopUID;
					}
					a.direction = data[i].Direction;
					console.log(a.direction);
					$('ul.station-list').append('<li data-stationid="'
					+ a.StopUID
					+ '" data-direction="'
					+ a.direction
					+ '">'
					+ '<div class="eta animated pulse"></div>'
					+ '<div class="station-name">'
					+ a.name
					+'</div>'
					+ '</li>');
					stops.push(a);
				});
				if(nearestDistance <= 0.8){
					$('li').filter(function(){
						return $(this).data('stationid') === nearestPosition;
					}).addClass('URhere');
				}
			});

			getBusTime(routeName);
		}
	});

	// 加上上一頁
	window.history.pushState({
		routeName,
	}, routeName, '?RouteName=' + routeName);
}

function getBusTime(routeName, notFirstTime){
	// 取得各站點進站時間
	$.ajax({
		url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/EstimatedTimeOfArrival/City/Kaohsiung/' + routeName + '?$format=json',
		method: 'GET',
		dataType: 'json',
		success: function(data){
			var dataForth = [];
			var dataBack = [];
			Object.keys(data).forEach((i) => {
				if(data[i].Direction === 0){
					dataForth.push(data[i]);
				}else{
					dataBack.push(data[i]);
				}
			});
			dataForth.sort(function(a, b){
				return a.EstimateTime > b.EstimateTime ? 1 : -1
			});
			dataBack.sort(function(a, b){
				return a.EstimateTime > b.EstimateTime ? 1 : -1
			});

			data = dataForth.concat(dataBack);

			var PlateNumbs = [];
			Object.keys(data).forEach((i) => {
				var StopUID = data[i].StopUID;
				var direction = data[i].Direction;
				var PlateNumb = data[i].PlateNumb;
				var $li = $('li').filter(function(){
					return $(this).data('stationid') === StopUID &&
					$(this).data('direction') === direction;
				});
				var eta = Math.round((new Date(data[i].NextBusTime).getTime() - new Date().getTime()) / 1000 / 60);
				if(!isNaN(eta)){
					if($.inArray(PlateNumb, PlateNumbs) < 0 && eta <= 1){
						$li.find('.eta').text('進站中');
						$li.prepend('<div class="bus-plate">' + PlateNumb + '</div>');
						PlateNumbs.push(PlateNumb);
						$li.addClass('comming');
					}else if(eta < 0){
						$li.find('.eta').text('駛離');
						$li.removeClass('comming');
					}else{
						$li.find('.eta').text(eta + '分');
						$li.removeClass('comming');
					}
				}else{
					$li.find('.eta').text('-');
					$li.removeClass('comming');
				}
			});
			$('li.comming .eta').addClass('animated pulse infinite');
			if(!notFirstTime) {
				if($('#station-list li').filter(function(){return $(this).data('direction') === 0}).length){
					$('#station-list li').filter(function(){return $(this).data('direction') === 0}).show();
					$('#station-list li').filter(function(){return $(this).data('direction') === 1}).hide();
				}else{
					$('.direction-back').click();
				}
			}

			setTimeout(getBusTime(routeName, true), 1000);
		}
	});
}

// 兩點距離
function distanceLatlng(pos1, pos2){
	var lat1 = pos1.lat;
	var lat2 = pos2.lat;
	if(lat1 === 0 && lat2 === 0 ) return 9999999999;
	var lng1 = pos1.lng;
	var lng2 = pos2.lng;
	var R = 6371; // km
	var dLat = toRad(lat2-lat1);
	var dLon = toRad(lng2-lng1);
	var lat1 = toRad(lat1);
	var lat2 = toRad(lat2);

	var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
	Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = R * c;
	return d;
}

function toRad(Value){
	return Value * Math.PI / 180;
}

// 取得網址參數用
function getParameterByName(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}