const chatBody = document.getElementById('chat-body')
const chatInput = document.getElementById('chat-input')
const chatSend = document.getElementById('chat-send')

function appendMessage(text, who='bot'){
  const div = document.createElement('div')
  div.className = 'msg '+(who==='user'?'user':'bot')
  div.textContent = text
  chatBody.appendChild(div)
  chatBody.scrollTop = chatBody.scrollHeight
}

async function sendMessage(){
  const text = chatInput.value.trim()
  if(!text) return
  appendMessage(text,'user')
  chatInput.value=''
  // show temporary loading
  const loader = document.createElement('div'); loader.className='msg bot'; loader.textContent='…'; chatBody.appendChild(loader); chatBody.scrollTop = chatBody.scrollHeight;
  try{
    // try LLM endpoint first
    let data;
    const res1 = await fetch('/chat-llm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})})
    if(res1.ok){ data = await res1.json() }
    if(!data || !data.reply){
      const res2 = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})})
      data = await res2.json()
    }
    loader.remove()
    appendMessage(data.reply || 'Sorry, no reply')
  }catch(e){
    loader.remove()
    appendMessage('Error connecting to server')
  }
}

chatSend.addEventListener('click', sendMessage)
chatInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendMessage() })

// greet
appendMessage('Hi! I am a profile bot. Ask me about skills, projects, education or contact details.')
