var currentPosition = {};

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
	// 可愛動畫
	$('.eta').addClass('animated pulse');

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
				$('ul.bus-list').append('<li data-routeid="'
				+ result[i].RouteID
				+'"><div class="ddesc">'
				+ result[i].DepartureStopNameZh + '-' + result[i].DestinationStopNameZh
				+ '</div><div class="route-name">'
				+ result[i].RouteName.Zh_tw
				+ '</div></li>');
			});
			$('body').delegate('.bus-list li', 'click', function(){
				// 隱藏大 section
				$('section#bus-list').hide();
				$('section#station-list').show();

				var routeName = $(this).find('.route-name').text();
				$('ul.station-list').html('');
				$('section#station-list').find('h2').html('<i class="fa fa-bus"></i> ' + routeName);

				$.ajax({
					url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/StopOfRoute/City/Kaohsiung/' + routeName + '?$format=json',
					method: 'GET',
					dataType: 'json',
					success: function(data){
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
								$('ul.station-list').append('<li data-stationid="'
								+ a.StopUID
								+ '" data-direction="'
								+ a.direction
								+ '">'
								+ '<div class="eta"></div>'
								+ '<div class="station-name">'
								+ a.name
								+'</div>'
								+ '</li>');
								stops.push(a);
							});
							$('li').filter(function(){
								return $(this).data('stationid') === nearestPosition;
							}).addClass('URhere');
						});
						$.ajax({
							url: 'https://ptx.transportdata.tw/MOTC/v2/Bus/EstimatedTimeOfArrival/City/Kaohsiung/' + routeName + '?$format=json',
							method: 'GET',
							dataType: 'json',
							success: function(data){
								Object.keys(data).forEach((i) => {
									var StopUID = data[i].StopUID;
									var direction = data[i].Direction;
									var PlateNumb = data[i].PlateNumb;
									var $li = $('li').filter(function(){
										return $(this).data('stationid') === StopUID &&
										$(this).data('direction') === direction;
									});
									var eta = Math.round((new Date(data[i].NextBusTime).getTime() - new Date().getTime()) / 1000 / 60);
									var isComing = false;
									if(isComing === false && eta === 0){
										$li.find('.eta').text('進站中');
										$li.prepend('<div class="bus-plate">' + PlateNumb + '</div>');
										isComing = true;
										$li.addClass('comming');
									}else if(eta < 0){
										$li.find('.eta').text('已駛離');
										$li.removeClass('comming');
									}else{
										isComing = false;
										$li.find('.eta').text(eta + '分');
										$li.removeClass('comming');
									}
								})
							}
						});
					}
				});

				// 加上上一頁
				window.history.pushState({
					routeName: $(this).find('.route-name').text(),

				}, $($(this).find('.route-name')[0]).text(), '?RouteName=' + routeName);
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
			$('section#bus-list').show().siblings().hide();
		}
	}
});

function distanceLatlng(pos1, pos2){
	var lat1 = pos1.lat;
	var lat2 = pos2.lat;
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