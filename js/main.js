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
		url: 'http://ptx.transportdata.tw/MOTC/v2/Bus/Route/City/Kaohsiung?$format=json',
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
				$('section#bus-list').hide();
				$('section#station-list').show();

				// 加上上一頁
				window.history.pushState({
					routeId: $(this).data('routeid'),

				}, $($(this).find('.route-name')[0]).text(), '?RouteID=' + $(this).data('routeid'));
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