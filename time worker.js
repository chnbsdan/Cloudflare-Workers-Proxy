addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
      const url = new URL(request.url);

      // 如果访问根目录，返回新的HTML模板
      if (url.pathname === "/") {
          return new Response(getRootHtml(), {
              headers: {
                  'Content-Type': 'text/html; charset=utf-8'
              }
          });
      }

      // 从请求路径中提取目标 URL
      let actualUrlStr = decodeURIComponent(url.pathname.replace("/", ""));

      // 判断用户输入的 URL 是否带有协议
      actualUrlStr = ensureProtocol(actualUrlStr, url.protocol);

      // 保留查询参数
      actualUrlStr += url.search;

      // 创建新 Headers 对象，排除以 'cf-' 开头的请求头
      const newHeaders = filterHeaders(request.headers, name => !name.startsWith('cf-'));

      // 创建一个新的请求以访问目标 URL
      const modifiedRequest = new Request(actualUrlStr, {
          headers: newHeaders,
          method: request.method,
          body: request.body,
          redirect: 'manual'
      });

      // 发起对目标 URL 的请求
      const response = await fetch(modifiedRequest);
      let body = response.body;

      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
          body = response.body;
          // 创建新的 Response 对象以修改 Location 头部
          return handleRedirect(response, body);
      } else if (response.headers.get("Content-Type")?.includes("text/html")) {
          body = await handleHtmlContent(response, url.protocol, url.host, actualUrlStr);
      }

      // 创建修改后的响应对象
      const modifiedResponse = new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
      });

      // 添加禁用缓存的头部
      setNoCacheHeaders(modifiedResponse.headers);

      // 添加 CORS 头部，允许跨域访问
      setCorsHeaders(modifiedResponse.headers);

      return modifiedResponse;
  } catch (error) {
      // 如果请求目标地址时出现错误，返回带有错误消息的响应和状态码 500（服务器错误）
      return jsonResponse({
          error: error.message
      }, 500);
  }
}

// 确保 URL 带有协议
function ensureProtocol(url, defaultProtocol) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : defaultProtocol + "//" + url;
}

// 处理重定向
function handleRedirect(response, body) {
  const location = new URL(response.headers.get('location'));
  const modifiedLocation = `/${encodeURIComponent(location.toString())}`;
  return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
          ...response.headers,
          'Location': modifiedLocation
      }
  });
}

// 处理 HTML 内容中的相对路径
async function handleHtmlContent(response, protocol, host, actualUrlStr) {
  const originalText = await response.text();
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  let modifiedText = replaceRelativePaths(originalText, protocol, host, new URL(actualUrlStr).origin);

  return modifiedText;
}

// 替换 HTML 内容中的相对路径
function replaceRelativePaths(text, protocol, host, origin) {
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  return text.replace(regex, `$1${protocol}//${host}/${origin}/`);
}

// 返回 JSON 格式的响应
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
      status: status,
      headers: {
          'Content-Type': 'application/json; charset=utf-8'
      }
  });
}

// 过滤请求头
function filterHeaders(headers, filterFunc) {
  return new Headers([...headers].filter(([name]) => filterFunc(name)));
}

// 设置禁用缓存的头部
function setNoCacheHeaders(headers) {
  headers.set('Cache-Control', 'no-store');
}

// 设置 CORS 头部
function setCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  headers.set('Access-Control-Allow-Headers', '*');
}

// 返回根目录的 HTML - 使用新的模板
function getRootHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxy Everything</title>
    <link rel="icon" href="https://pan.hangdn.com/raw/ico/map64.ico" type="image/ico">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
            position: relative;
            color: white;
        }
        
        /* 背景容器样式 */
        .background-container {
            position: fixed;
            inset: 0;
            z-index: -2;
            overflow: hidden;
        }
        
        .background-slide {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 1.6s ease;
        }
        
        .background-slide.active {
            opacity: 1;
        }
        
        /* 黑色遮罩层 */
        .bg-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.30);
            z-index: -1;
            pointer-events: none;
        }
        
        /* 主容器 */
        .container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        /* 内容卡片 */
        .content-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 600px;
            width: 100%;
            text-align: center;
        }
        
        .content-card h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
            text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        }
        
        .content-card p {
            font-size: 1.2rem;
            line-height: 1.6;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        /* 输入表单样式 */
        .url-form {
            margin: 30px 0;
        }
        
        .input-container {
            position: relative;
            margin-bottom: 20px;
        }
        
        .url-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 20px;
            padding: 15px 20px;
            color: white;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .url-input:focus {
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .url-input::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        
        .submit-btn {
            background: rgba(255, 255, 255, 0.3);
            border: none;
            border-radius: 20px;
            padding: 12px 30px;
            color: white;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .submit-btn:hover {
            background: rgba(255, 255, 255, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        /* 页脚样式 */
        footer {
            padding: 20px 0;
            text-align: center;
            background: transparent;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.7);
            position: relative;
            width: 100%;
            margin-top: auto;
        }

        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        .footer-links {
            margin-bottom: 10px;
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
        }

        .footer-links a {
            color: rgba(255, 255, 255, 0.7);
            text-decoration: none;
            transition: all 0.3s ease;
            font-size: 0.85rem;
            padding: 5px 10px;
            border-radius: 5px;
        }

        .footer-links a:hover {
            color: white;
            background: rgba(255, 255, 255, 0.1);
            text-decoration: none;
        }
        
        .runtime-section {
            text-align: center;
            line-height: 1.4;
            padding: 15px 0 0 0;
            margin-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .runtime-info {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 5px;
        }
        
        .tech-info {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .days-count {
            font-weight: bold;
            color: #f59e0b;
        }
        
        /* 响应式调整 */
        @media (max-width: 768px) {
            .content-card {
                padding: 25px;
            }
            
            .content-card h1 {
                font-size: 2rem;
            }
            
            .content-card p {
                font-size: 1rem;
            }
            
            .footer-links {
                gap: 15px;
            }
            
            .footer-links a {
                font-size: 0.8rem;
                padding: 4px 8px;
            }
        }
        
        @media (max-width: 480px) {
            .content-card {
                padding: 20px;
            }
            
            .content-card h1 {
                font-size: 1.8rem;
            }
            
            .footer-links {
                gap: 10px;
            }
            
            .footer-links a {
                font-size: 0.75rem;
                padding: 3px 6px;
            }
        }
    </style>
</head>
<body>
    <!-- 背景容器 -->
    <div class="background-container">
        <img src="https://webp.hangdn.com/fg/fg1.jpg" class="background-slide active" alt="bg1">
        <img src="https://webp.hangdn.com/fg/fg2.jpg" class="background-slide" alt="bg2">
        <img src="https://webp.hangdn.com/fg/yk5.jpg" class="background-slide" alt="bg3">
        <img src="https://pan.hangdn.com/raw/img/352347587.jpg" class="background-slide" alt="bg4">
        <img src="https://pan.hangdn.com/raw/img/377786273.jpg" class="background-slide" alt="bg5">
        <img src="https://webp.hangdn.com/fg/fj22.jpg" class="background-slide" alt="bg6">
        <img src="https://webp.hangdn.com/fg/yk1.jpg" class="background-slide" alt="bg7">
        <img src="https://webp.hangdn.com/fg/yk2.jpg" class="background-slide" alt="bg8">
        <img src="https://webp.hangdn.com/fg/yk3.jpg" class="background-slide" alt="bg9">
        <img src="https://webp.hangdn.com/fg/sh3.jpg" class="background-slide" alt="bg10">
        <img src="https://webp.hangdn.com/fg/sh2.jpg" class="background-slide" alt="bg11">
        <img src="https://webp.hangdn.com/fg/sh1.jpg" class="background-slide" alt="bg12">
        <img src="https://webp.hangdn.com/fg/bj1.jpg" class="background-slide" alt="bg13"> 
    </div>
    <div class="bg-overlay"></div>
    
    <!-- 主内容区域 -->
    <div class="container">
        <div class="content-card">
            <h1><i class="fas fa-link"></i> Proxy Everything</h1>
            <p>通过 Cloudflare Workers 代理访问任何网站</p>
            
            <div class="url-form">
                <form id="urlForm" onsubmit="redirectToProxy(event)">
                    <div class="input-container">
                        <input type="text" id="targetUrl" class="url-input" placeholder="在此输入目标地址 (例如: example.com)" required>
                    </div>
                    <button type="submit" class="submit-btn">
                        <i class="fas fa-external-link-alt"></i> 跳转
                    </button>
                </form>
            </div>
            
            <p style="font-size: 0.9rem; opacity: 0.7;">
                输入完整的网址或域名，系统将自动添加协议前缀
            </p>
        </div>
    </div>
    
    <!-- 页脚 -->
    <footer>
        <div class="footer-content">
            <div class="footer-links">
                <a href="https://hangdn.com" target="_blank">
                    <i class="fas fa-info-circle"></i> 关于我们
                </a>
                <a href="#" id="contact-link">
                    <i class="fas fa-envelope"></i> 联系我们
                </a>
                <a href="#" id="privacy-link">
                    <i class="fas fa-shield-alt"></i> 隐私政策
                </a>
                <a href="#" id="terms-link">
                    <i class="fas fa-file-contract"></i> 使用条款
                </a>
                <a href="https://github.com/chnbsdan" target="_blank">
                    <i class="fab fa-github"></i> 项目仓库
                </a> 
            </div>
            
            <div class="runtime-section">
                <div class="runtime-info">
                    本站已稳定运行 <span id="runtime-display" class="days-count">0天 00:00:00</span>
                </div>
                <div class="tech-info">
                    © 2025 Proxy Everything - 基于 Cloudflare Workers 搭建
                </div>
            </div>
        </div>
    </footer>

    <script>
        // 背景轮播功能
        function initBackgroundRotation() {
            const bgImgs = document.querySelectorAll('.background-slide');
            let bgIndex = 0;
            
            // 每10秒切换一次背景
            setInterval(() => {
                bgImgs.forEach((img, i) => img.classList.toggle('active', i === bgIndex));
                bgIndex = (bgIndex + 1) % bgImgs.length;
            }, 10000);
        }
        
        // 页脚链接功能
        function initFooterLinks() {
            // 联系我们链接
            document.getElementById('contact-link').addEventListener('click', function(e) {
                e.preventDefault();
                alert('联系我们：请发送邮件至 chnbsdan@gmail.com');
            });
            
            // 隐私政策链接
            document.getElementById('privacy-link').addEventListener('click', function(e) {
                e.preventDefault();
                alert('隐私政策：我们非常重视您的隐私，不会收集或分享您的个人信息。');
            });
            
            // 使用条款链接
            document.getElementById('terms-link').addEventListener('click', function(e) {
                e.preventDefault();
                alert('使用条款：本代理服务仅供个人使用，请遵守相关法律法规。');
            });
        }
        
        // 精确到秒的运行时间统计
        function updateRuntime() {
            const startDate = new Date('2023-09-01T00:00:00'); // 修改为您的建站日期和时间
            
            function calculateRuntime() {
                const currentDate = new Date();
                const timeDiff = currentDate.getTime() - startDate.getTime();
                
                // 计算天、时、分、秒
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                
                // 格式化时间显示
                const formattedHours = hours.toString().padStart(2, '0');
                const formattedMinutes = minutes.toString().padStart(2, '0');
                const formattedSeconds = seconds.toString().padStart(2, '0');
                
                const runtimeElement = document.getElementById('runtime-display');
                if (runtimeElement) {
                    runtimeElement.textContent = `${days}天 ${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
                }
            }
            
            // 立即计算一次
            calculateRuntime();
            
            // 每秒更新一次
            setInterval(calculateRuntime, 1000);
        }
        
        // 代理跳转功能
        function redirectToProxy(event) {
            event.preventDefault();
            const targetUrl = document.getElementById('targetUrl').value.trim();
            const currentOrigin = window.location.origin;
            window.open(currentOrigin + '/' + encodeURIComponent(targetUrl), '_blank');
        }
        
        // 页面加载时初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化背景轮播
            initBackgroundRotation();
            
            // 初始化页脚链接功能
            initFooterLinks();
            
            // 更新运行时间（精确到秒）
            updateRuntime();
            
            // 自动聚焦到输入框
            document.getElementById('targetUrl').focus();
        });
    </script>
</body>
</html>`;
}
