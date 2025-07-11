
document.addEventListener('DOMContentLoaded', async () => {

    //PEER VARIABLES DECLARATION
    let localId = ''
    let myConnection = null
    let onlineConnections = []
    let localstream = null
    //CODE EDITOR INIT
    const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
        lineNumbers: true,
        theme: "icecoder",
        mode: 'javascript'
    })
    let remoteUpdate = false

    //PEER - SOCKET INIT
    const socket = io('https://codesync-server-production.up.railway.app/')
    const peer = new Peer()
    
    //LOADING FILES VIA API
    loadFiles()

    //FETCH WORKSPACE FROM LOCAL STORAGE 
    const workspace = JSON.parse(localStorage.getItem('workspace'))

    //WORKSPACE VARIABLES INIT
    let currentFile = ''

    //SENDING WORKSPACE DETAILS TO SERVER
    peer.on('open', (id) => {
        localId = id

        socket.emit('join', { id, remote: workspace.username, space: workspace.workspaceName })
    })

    

    //RECEIVING OTHER CLIENTS IDs
    socket.on('joined', ({ id, usersList }) => {

        //UPDATING USER LIST
        for (let index = 0; index < usersList.length; index++) {
            updateUser(index, usersList[index])
        }

        if (localId === id) {
            console.log('YOU JOINED WORKSPACE')
        } else {
            console.log(id, ' JOINED WORKSPACE')

            //SENDING CONNECTIONS TO ALL REMOTE IDs
            myConnection = peer.connect(id)
            if (myConnection) {
                onlineConnections.push(myConnection)
                //ON SUCCESSFULL CONNECTIONS

                myConnection.on('open', () => {
                    console.log('CONNECTION SENT')
                    console.log('FROM: ', localId)
                    console.log('TO: ', id)
                    //CHECKING CURRENT CONNECTIONS LENGTH
                    console.log('NUMBER OF CONNECTIONS: ', onlineConnections.length)
                    //RECEIVING DATA
                    myConnection.on('data', data => {

                        if (data.type === 'chat') {
                            addMessages(data.id, data.username, data.message)

                        } else if (data.type === 'code') {
                            remoteUpdate = true
                            if (remoteUpdate && (data.remoteFile === currentFile)) {
                                const cursor = editor.getCursor()
                                editor.setValue(data.code)
                                editor.setCursor(cursor)
                                remoteUpdate = false

                            }
                        }
                    })
                })

            }
        }
    })
    
    //LOADING FILES FUNCTION VIA API
    async function loadFiles(){
        const res = await fetch('https://codesync-server-production.up.railway.app/files')
        const filesviaAPI = await res.json()
        document.getElementById('file-tree').innerHTML = ''
         for (let index = 0; index < filesviaAPI.length; index++) {
            if (filesviaAPI[index] != null && filesviaAPI[index] != '') {
                appendFiles(filesviaAPI[index])            
            }
        }
    }

      //LOADING FILES VIA SOCKET
     socket.on('get-files', ({files})=>{ 
        document.getElementById('file-tree').innerHTML = ''
        for (let index = 0; index < files.length; index++) {
              if (files[index] != null && files[index] != '') {
                appendFiles(files[index])            
            }
        }
    })
  

    //HANDLING INCOMING CONNECTIONS
    peer.on('connection', conn => {
        myConnection = conn
        onlineConnections.push(conn)
        console.log('CONNECTION RECEIVED')
        console.log('BY: ', localId)
        console.log('FROM ', conn.peer)

        //CHECKING CURRENT CONNECTIONS LENGTH
        console.log('NUMBER OF CONNECTIONS: ', onlineConnections.length)
        //RECEIVING DATA
        myConnection.on('data', data => {
            if (data.type === 'chat') {
                addMessages(data.id, data.username, data.message)

            } else if (data.type === 'code') {
                remoteUpdate = true
                if (remoteUpdate  && (data.remoteFile === currentFile)) {
                    const cursor = editor.getCursor()
                    editor.setValue(data.code)
                    editor.setCursor(cursor)
                    remoteUpdate = false

                }
            }
        })

    })


      //SENDING CALLS
    document.getElementById('mic').addEventListener('click', async ()=>{
        try{
            const media = await navigator.mediaDevices.getUserMedia({video:false, audio:true})
            localstream = media
            for (let index = 0; index < onlineConnections.length; index++) {
                if (onlineConnections[index].peer != localId) {
                    const call= peer.call(onlineConnections[index].peer, media)
                    call.on('stream', stream => {
                        const audio = new Audio()
                        audio.srcObject = stream
                        audio.play()
                    })
                }
            }
        }catch(err){
            alert(err.name)
        }
    })
    

    //RECEIVING CALLS
    peer.on('call', incomingcall =>{
        incomingcall.answer(localstream)
         incomingcall.on('stream', stream => {
                        const audio = new Audio()
                        audio.srcObject = stream
                        audio.play()
                    })
    })

    //CODE SYNCRONIZATION
    editor.on('change', (instance) => {
        if (myConnection && !remoteUpdate) {
            for (let index = 0; index < onlineConnections.length; index++) {
                onlineConnections[index].send({ type: 'code', remoteFile: currentFile, code: instance.getValue() })
                socket.emit('send-code-server', {workspace: workspace.workspaceName, currentFile, code: instance.getValue()})
            }
        }
    })

    //CHATTING BETWEEN CLIENTS & AI
    document.getElementById('send-prompt-message').addEventListener('click', async() => {
        let messageText = document.getElementById('prompt-message-input').value.trim()
        let mode = document.getElementById('ai-mode-select').value
        addMessages(localId, workspace.username, messageText)
        if (mode === 'chat') {
            for (let index = 0; index < onlineConnections.length; index++) {
                onlineConnections[index].send({ type: "chat", id: localId, username: workspace.username, message: messageText })
            }
        }else if(mode === 'ai'){
            const res = await fetch('https://codesync-server-production.up.railway.app/gemini',{
                method:'POST',
                headers:{
                    'content-type':'application/json'
                },
                body:JSON.stringify({prompt:messageText})
            })
            const data = await res.json()
            const cleaned = data.response.replace(/```(?:json)?\n?/, '').replace(/```$/, '');
            
            const parsedResponse = JSON.parse(cleaned);
            const code = parsedResponse.code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            editor.setValue(code)
            addMessages('ai', 'AI Reposnse', parsedResponse.description)
        }
    })

    //CREATING NEW FILE
    document.getElementById('create-file').addEventListener('click', () => {
    let fileName = window.prompt("Enter File Name: ")
    currentFile = fileName
    socket.emit('create-file', {file: fileName, space:workspace.workspaceName})
   
    })

    
    //UPDATING UI ON NEW FILE
    function appendFiles(fileName) {
        // document.getElementById('file-tree').innerHTML = ''
        const file = document.createElement('li')
        file.innerHTML = `<i class="fa-regular fa-file-code"></i>${fileName}`
        document.getElementById('file-tree').appendChild(file)
        file.addEventListener('click', () => {
            currentFile = fileName
            document.getElementById('current-code-context').innerText = fileName
            getCode()
        })
    }


    //RETREIVING CURRENT FILE CODE 
    function getCode(){
        socket.emit('send-code-client', {currentFile})
        socket.off('get-code')
        socket.on('get-code', ({code})=>{
            if (currentFile.endsWith('.me')) {
                editor.setValue(code)
            }else{
                editor.setValue(code)
            }
        })
    }

    //UPDATE UI ON CHATTING
    function addMessages(id, username, message) {
        const chatContainer = document.getElementById('chat-messages')
        const newMessage = document.createElement('li')
        if (localId === id && localId !== 'ai') {
            newMessage.classList.add('message', 'user')
        } else {
            newMessage.classList.add('message', 'friend')
        }
        const parsedInput = marked.parse(message)
        newMessage.innerHTML = ` <div class="message-header">
                            <span>${username}</span><i class="fa-solid fa-user"></i>
                        </div><div class="message-content">${parsedInput}</div>`
        chatContainer.append(newMessage)
    }

    // LOGIC TO CODE
    document.getElementById('logic').addEventListener('click', async ()=>{
        const res = await fetch('https://codesync-server-production.up.railway.app/gemini', {
            method:'POST',
            headers:{
                'content-type':'application/json'
            },
            body:JSON.stringify({
                prompt:`Convert this logic/text into code: ${editor.getValue()}`
            })
        })
              const data = await res.json()
            const cleaned = data.response.replace(/```(?:json)?\n?/, '').replace(/```$/, '');
            
            const parsedResponse = JSON.parse(cleaned);
            const code = parsedResponse.code.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            editor.setValue(code)
            addMessages('ai', 'AI Reposnse', parsedResponse.description)
    })

    //UPDATE UI ON NEW CONNECTION
    function updateUser(index, username) {
        const usersList = document.getElementById('users-list')
        if (index == 0) {
            usersList.innerHTML = ''
        }
        const newUser = document.createElement('li')
        newUser.classList.add('user-list-item')
        newUser.innerHTML = `<span class="user-avatar">${username.slice(0, 1)}</span> <span class="user-name">${username}</span>`
        usersList.append(newUser)
    }

  
})