import urllib.parse
import urllib.request
import json
import sys


def request(url, headers, params):
    req = urllib.request.Request(url, urllib.parse.urlencode(params).encode("utf-8"), headers)
    response = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(response)
    return data


params1 = {
    'login': sys.argv[1],
    'password': sys.argv[2]
}

headers1 = {
    'x-vendor-id': 'MyJABLOTRON',
    'Content-Type': 'application/x-www-form-urlencoded'
}

r = request(url='https://api.jablonet.net/api/1.6/login.json', headers=headers1, params=params1)

if r['status'] is True:
    session_id = r['session_id']
    headers2 = {
        'x-vendor-id': 'MyJABLOTRON'
    }

    params2 = {
        'list_type': 'extended'
    }
    req2 = urllib.request.Request('https://api.jablonet.net/api/1.6/getServiceList.json',
                                  urllib.parse.urlencode(params2).encode("utf-8"), headers2)
    req2.add_header('Cookie', 'PHPSESSID={}'.format(session_id))
    response2 = urllib.request.urlopen(req2).read().decode('utf-8')
    data2 = json.loads(response2)
    print("Found the following services:")
    for service in data2['services']:
        print("Service_id: {} \n"
              "Service_name: {}\n"
              "Alarm_type: {}\n\n".format(service['id'], service['name'], service['service_type']))

        headers3 = {
            'x-vendor-id': 'MyJABLOTRON',
            'User-Agent': 'MyJABLOTRON 3.5.2.153_PUB/Android',
        }

        params3 = {
            'data': '[{"filter_data":[{"data_type":"section"},{"data_type":"keyboard"},{"data_type":"pgm"}],"service_type":"ja100","service_id":' + str(
                service['id']) + ',"data_group":"serviceData","connect":true}]'
        }
        req3 = urllib.request.Request('https://api.jablonet.net/api/1.6/dataUpdate.json',
                                      urllib.parse.urlencode(params3).encode("utf-8"), headers3)
        req3.add_header('Cookie', 'PHPSESSID={}'.format(session_id))
        response3 = urllib.request.urlopen(req3).read().decode('utf-8')
        data3 = json.loads(response3)
        print("This alarm has the following segments: \n\n")
        segments = data3['data']['service_data'][0]['data'][0]['data']['segments']
        keyboards = data3['data']['service_data'][0]['data'][1]['data']['segments']
        for segment in segments:
            segmentId = segment['segment_id']
            keyboardKey = ''
            for keyboard in keyboards:
                if keyboard['segment_id'] == segmentId and keyboard['segment_type'] == 'keyboard':
                    keyboardKey = keyboard['segment_key']
                    break

            print("Segment_id: {}\n"
                  "Segment_key: {}\n"
                  "Keyboard_key: {}\n"
                  "Segment_name: {}\n\n"
                  .format(segment['segment_id'], segment['segment_key'], keyboardKey, segment['segment_name']))

        print("This alarm has the following switches (PGM): \n\n")
        segments = data3['data']['service_data'][0]['data'][2]['data']['segments']
        for segment in segments:
            print("Segment_id: {}\n"
                  "Segment_key: {}\n"
                  "Segment_name: {}\n\n"
                  .format(segment['segment_id'], segment['segment_key'], segment['segment_name']))
