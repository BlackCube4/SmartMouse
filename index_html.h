const char* INDEX_HTML = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <title>ESP32 S3 HID</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!--###################################
  #                                     #
  #                  CSS                #
  #                                     #
  ####################################-->

  <style>
    body { 
      font-family: Arial, 
      sans-serif; 
      text-align: center; 
      margin: 0; 
      padding: 20px; 
      background-color: #f4f4f4; 
    }

    h1 { 
      color: #333; 
    }

    .status { 
      margin-bottom: 20px; 
      font-weight: bold; 
    }

    .controls-grid { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 10px; 
      max-width: 400px; 
      margin: 0 auto; 
    }

    button { 
      padding: 15px 10px; 
      font-size: 16px; 
      border: none; 
      border-radius: 5px; 
      cursor: pointer; 
      background-color: #007bff; 
      color: white; 
      transition: background-color 0.2s; 
    }

    button:active { 
      background-color: #0056b3; 
    }

    #mouse-pad { 
      background-color: #fff; 
      border: 2px solid #ccc; 
      width: 100%; height: 200px; 
      margin: 20px auto; 
      border-radius: 10px; 
      cursor: crosshair; 
    }

    .spacer { 
      visibility: hidden; 
    }
  </style>
</head>


<!--###################################
#                                     #
#                 HTML                #
#                                     #
####################################-->

<body>
  <h1>ESP32 S3 HID Controller</h1>
  <p class="status">Status: <span id="ws-status" style="color: red;">DISCONNECTED</span></p>

  <div class="controls-grid">
    <div class="spacer"></div>
    <button onmousedown="sendCmd(0x21, 1)" onmouseup="sendCmd(0x22, 1)" ontouchstart="sendCmd(0x21, 1)" ontouchend="sendCmd(0x22, 1)">Left Click</button>
    <div class="spacer"></div>
    <button onmousedown="sendCmd(0x11, 0x1A)" onmouseup="sendCmd(0x12, 0x1A)" ontouchstart="sendCmd(0x11, 0x1A)" ontouchend="sendCmd(0x12, 0x1A)">W</button>
    <button onmousedown="sendCmd(0x11, 0x04)" onmouseup="sendCmd(0x12, 0x04)" ontouchstart="sendCmd(0x11, 0x04)" ontouchend="sendCmd(0x12, 0x04)">A</button>
    <button onmousedown="sendCmd(0x11, 0x16)" onmouseup="sendCmd(0x12, 0x16)" ontouchstart="sendCmd(0x11, 0x16)" ontouchend="sendCmd(0x12, 0x16)">S</button>
    <button onmousedown="sendCmd(0x11, 0x07)" onmouseup="sendCmd(0x12, 0x07)" ontouchstart="sendCmd(0x11, 0x07)" ontouchend="sendCmd(0x12, 0x07)">D</button>
    <button onclick="sendCmd(0x23, 2)">Right Click</button>
    <button onclick="sendCmd(0x23, 4)">Middle Click</button>
  </div>

  <p>Mouse Pad (Drag to move)</p>
  <div id="mouse-pad"></div>

  <!--###################################
  #                                     #
  #                  JS                 #
  #                                     #
  ####################################-->

  <script>
    var gateway = `ws://${window.location.hostname}:81/`;
    var websocket;

    window.addEventListener('load', onload);

    function onload(event) {
      initWebSocket();
      initMousePad();
    }

    function initWebSocket() {
      console.log('Trying to open a WebSocket connection...');
      websocket = new WebSocket(gateway);
      websocket.binaryType = "arraybuffer"; // Set to arraybuffer
      websocket.onopen = onOpen;
      websocket.onclose = onClose;
      websocket.onmessage = onMessage;
    }

    function onOpen(event) {
      console.log('Connection opened');
      document.getElementById('ws-status').innerHTML = "CONNECTED";
      document.getElementById('ws-status').style.color = "green";
    }

    function onClose(event) {
      console.log('Connection closed');
      document.getElementById('ws-status').innerHTML = "DISCONNECTED";
      document.getElementById('ws-status').style.color = "red";
      setTimeout(initWebSocket, 2000); // Attempt to reconnect
    }

    function onMessage(event) {
      // Not strictly necessary, but good for debugging messages from ESP32
      console.log("Message from server: " + event.data);
    }
    
    // Sends a 2-byte command: [OPCODE, VALUE]
    function sendCmd(opcode, value) {
      if (websocket.readyState === 1) {
        var buffer = new Uint8Array(2);
        buffer[0] = opcode;
        buffer[1] = value;
        websocket.send(buffer);
        console.log("Sent Binary Cmd: " + opcode.toString(16) + ", " + value.toString(16));
      }
    }

    var mousePad = document.getElementById('mouse-pad');
    var isDragging = false;
    var lastX = 0;
    var lastY = 0;
    
    function initMousePad() {
      mousePad.addEventListener('mousedown', startDrag);
      mousePad.addEventListener('touchstart', startDrag);
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
    }
    
    function getClientCoords(e) {
        return {
            x: e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : null),
            y: e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : null)
        };
    }

    function startDrag(e) {
      e.preventDefault();
      isDragging = true;
      var coords = getClientCoords(e);
      if (coords.x !== null) {
          lastX = coords.x;
          lastY = coords.y;
      }
    }
    
    // Format: [0x01, dx_L, dx_H, dy_L, dy_H]
    function drag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      var coords = getClientCoords(e);
      if (coords.x === null) return;
      
      var dx = coords.x - lastX;
      var dy = coords.y - lastY;
      
      // Scale and clamp to signed 16-bit integer range
      var moveX = Math.round(dx * 2);
      var moveY = Math.round(dy * 2);

      // We only send if there is actual movement
      if (moveX !== 0 || moveY !== 0) {
          // Send move command (0x01) with 16-bit little-endian values
          var buffer = new ArrayBuffer(5);
          var view = new DataView(buffer);
          
          view.setUint8(0, 0x01); // Opcode for RELATIVE MOUSE MOVE
          view.setInt16(1, moveX, true); // dx, little-endian (true)
          view.setInt16(3, moveY, true); // dy, little-endian (true)
          
          websocket.send(buffer);
          console.log(`Sent: MOVE:${moveX},${moveY}`);
      }
      
      lastX = coords.x;
      lastY = coords.y;
    }
    
    function endDrag(e) {
      isDragging = false;
    }
    
    // Format: [0x51, steps_L, steps_H]
    document.addEventListener('wheel', function(e) {
        if (websocket.readyState !== 1) return;
        
        var wheelDelta = Math.sign(e.deltaY) * -1; // Standard scroll down is +1, HID scroll down is negative
        
        var buffer = new ArrayBuffer(3);
        var view = new DataView(buffer);
        
        view.setUint8(0, 0x51); // Opcode for LOW RES SCROLL
        view.setInt16(1, wheelDelta, true); // value (steps), little-endian (true)
        
        websocket.send(buffer);
        console.log(`Sent: SCROLL:${wheelDelta}`);

        e.preventDefault();
    }, {passive: false});

  </script>
</body>
</html>
)rawliteral";