document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('create-btn').addEventListener('click', async() => {
        const workspaceName = document.getElementById('work').value.trim()
        const username = document.getElementById('user').value.trim()


            localStorage.setItem('workspace', JSON.stringify({username, workspaceName, host: true}))
            window.location.replace('index.html')
        
    })
        document.getElementById('join-btn').addEventListener('click', async() => {
        const workspaceName = document.getElementById('work').value.trim()
        const username = document.getElementById('user').value.trim()

            localStorage.setItem('workspace', JSON.stringify({username, workspaceName,host: false}))
            window.location.replace('index.html')
        
    })
})