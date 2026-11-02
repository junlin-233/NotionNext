---
title: "Example article"
slug: "example-1"
notionId: a82e88c6-c737-4796-a887-830f1e334e27
---

# Basic paragraph

> In the book there is a house of gold, in the book there is a beauty as fair as jade.

> 💡 The meaning of life is not to compete with others, but to enjoy the process of striving to achieve goals. The outcome is merely a commendation of one's own actions.

## **To the Guest of Honor**

By Li Bai (Tang Dynasty) [Reference [1]](https://chat.openai.com/c/9620e299-c5ee-424d-bf8f-bb87662550f0#a47eb4929c654ac4b8c895d00023a97e)

Have you not seen the waters of the Yellow River flowing from the sky, rushing to the sea, never to return? Have you not seen the bright hall's mirror mourning the arrival of white hair, morning's black silk turning evening's snow? When life is at its peak, one must revel in joy, never let a golden goblet empty under the moon. By heaven's decree, my talents shall find use, even if a fortune is squandered, it shall return. Feasting on lamb and beef, let us rejoice, let us drink three hundred cups in a single sitting. Cen the Philosopher, Danqiu born, raise your cup and let us not stop. Let me sing a song for you, please lend me your ears. Treasures of jade and delicacies of the banquet may be precious, but I wish only to remain drunk and never awaken. Throughout history, the wise and virtuous have all been lonely, only the drinkers leave behind their names. In ancient times, King Chen feasted in the Hall of Peace, ten thousand cups of wine in boisterous revelry. Why should the host speak of modest sums? Go, fetch and pour, let's drink together. With five-flower horses and robes of a thousand gold, call the servants to bring forth fine wine, and together, let us dispel the sorrows of a thousand generations.

[TANGLY's BLOG | 记录思考、分享我的学习笔记](https://tangly1024.com/)

# Special paragraph

## 1.Code

```Bash
# Bash 安装zsh $ sudo apt install zsh  # 配置ohmyzsh $ sh -c "$(curl -fsSL <https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh>)"  # 配置ohmyzsh插件 # zsh-autosuggestions $ git clone git://github.com/zsh-users/zsh-autosuggestions $ZSH_CUSTOM/plugins/zsh-autosuggestions  # zsh-syntax-highlighting $ git clone <https://github.com/zsh-users/zsh-syntax-highlighting.git> ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting  // 启用插件 $ vim .zshrc plugins=(git z zsh-autosuggestions zsh-syntax-highlighting)
```

- Other programming languages
  ```Bash
ps -ef | grep java | awk '{print $2}' | xargs kill -9
  ```

  ```Java
@Test public void test11() {    long start = System.currentTimeMillis();   int a = 0;   for(int i=0;i<1000000000;i++){       try {           a++;       }catch (Exception e){           e.printStackTrace();       }   }   long useTime = System.currentTimeMillis()-start;   System.out.println("useTime:"+useTime); }
  ```

  ```Python
#!/usr/bin/python3 import json   # Python 字典类型转换为 JSON 对象 data = {     'no' : 1,     'name' : 'hello',     'url' : 'http://tangly1024.com' }   json_str = json.dumps(data) print ("Python 原始数据：", repr(data)) print ("JSON 对象：", json_str)
  ```

  ```R
# R 语言 #file.edit(path.expand(file.path("~", ".Renviron"))) library(telegram.bot) library(stringr) # Initiate the bot session using the token from the enviroment variable. bot = Bot(token = bot_token('your_bot')) usr_list <- c(12344566, 12345566)
  ```

  ```CSS
html { 	background-color: red; }
  ```

  ```C++
#include <iostream> using namespace std;   // main() 是程序开始执行的地方   int main() {    cout << "Hello World"; // 输出 Hello World    return 0; }
  ```

  ```C#
using System; namespace HelloWorldApplication {    class HelloWorld    {       static void Main(string[] args)       {          Console.WriteLine("Hello World");          Console.ReadKey();       }    } }
  ```

  ```Assembly
.section __TEXT,__text,regular,pure_instructions .macosx_version_min 10, 13 .globl _add_a_b .p2align 4, 0x90 _add_a_b: ## @add_a_b .cfi_startproc ## BB#0: pushq %rbp Lcfi0: .cfi_def_cfa_offset 16 Lcfi1: .cfi_offset %rbp, -16 movq %rsp, %rbp Lcfi2: .cfi_def_cfa_register %rbp movl %edi, -4(%rbp) movl %esi, -8(%rbp) movl -4(%rbp), %esi addl -8(%rbp), %esi movl %esi, %eax popq %rbp retq .cfi_endproc  .globl _main .p2align 4, 0x90 _main: ## @main .cfi_startproc ## BB#0: pushq %rbp Lcfi3: .cfi_def_cfa_offset 16 Lcfi4: .cfi_offset %rbp, -16 movq %rsp, %rbp Lcfi5: .cfi_def_cfa_register %rbp subq $16, %rsp movl $1, %edi movl $2, %esi movl $0, -4(%rbp) callq _add_a_b addq $16, %rsp popq %rbp retq .cfi_endproc
  ```

## 2.Equation

- Mathematical formulas
  $$
f\left(\left[\frac{1+\{x, y\}}{\left(\frac{x}{y}+\frac{y}{x}\right)(u+1)}+a\right]^{3 / 2}\right)\tag{行标}
  $$

  $$
\tau_{xy}=-\tau_{yx}\tau_{xz}=-\tau_{zx}\tau_{yz}=-\tau{zy}
  $$

- Chemical equations
  $\ce{2H2O->2H2 + O2}
$

- Other formulas
  $$
\begin{aligned} AACD \Rightarrow AAAD &= \frac 1 3\\  AACD \Rightarrow AACD &= \frac 1 3 + \frac 1 6 = \frac 1 2  \\  AACD \Rightarrow AACC &= \frac 1 6 \end{aligned}
  $$

  $$
\begin{bmatrix} 		c_{0}&c_{n-1}&c_{n-2}&\cdots &c_{1}\\ 		c_{1}&c_{0}&c_{n-1} &  \cdots &c_{2}\\ 		c_{2}&c_{1}&c_{0}&\cdots  &c_3 \\ 		\vdots &\vdots& \vdots&\ddots &\vdots \\ 		c_{n-1}&c_{n-2}&c_{n-3}&\dots &c_{0} \end{bmatrix}
  $$

  $$
\begin{aligned} \sin 2\theta & = 2\sin \theta \cos \theta \\ & = \cfrac{2 \tan \theta}{1+\tan^2 \theta} \end{aligned}
  $$

  $$
AACD\Rightarrow \left\{\begin{matrix} 第1次取值 & 第2次取值 & 概率 & 最终状态\\ A & C,D &= \frac 1 2 \times \frac 2 3= \frac 1 3 &\Rightarrow AAAD \\  A & A &= \frac 1 2 \times \frac 1 3= \frac 1 6 &\Rightarrow AACD \\  C,D & A &= 2 \times \frac 1 4 \times \frac 2 3= \frac 1 3 &\Rightarrow CCAD \\  C,D & C,D &= 2 \times \frac 1 4 \times \frac 1 3= \frac 1 6 &\Rightarrow CCAA \end{matrix}\right. 
  $$

## 3. Charts

```Mermaid
graph LR; CompanyStructure-->Business CompanyStructure-->Research&Development CompanyStructure-->Design CompanyStructure-->Operations CompanyStructure-->Product
```

[https://prod-files-secure.s3.us-west-2.amazonaws.com/6c096b44-beb9-48ee-8f92-1efdde47f3a3/ded5d0f7-74e1-464b-b9af-ce10adc8b59f/%E4%B8%8B%E8%BD%BDPDF%E9%99%84%E4%BB%B6.pdf](https://prod-files-secure.s3.us-west-2.amazonaws.com/6c096b44-beb9-48ee-8f92-1efdde47f3a3/ded5d0f7-74e1-464b-b9af-ce10adc8b59f/%E4%B8%8B%E8%BD%BDPDF%E9%99%84%E4%BB%B6.pdf)

## 4.Download Attachment

[https://s3-us-west-2.amazonaws.com/secure.notion-static.com/fab11580-96c3-4230-90f6-05257f00fb0a/%E6%B5%8B%E8%AF%95%E5%B5%8C%E5%85%A5PDF.pdf](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/fab11580-96c3-4230-90f6-05257f00fb0a/%E6%B5%8B%E8%AF%95%E5%B5%8C%E5%85%A5PDF.pdf)

[https://prod-files-secure.s3.us-west-2.amazonaws.com/6c096b44-beb9-48ee-8f92-1efdde47f3a3/69f6fdf6-9aab-485a-a73d-d5c0d3f324db/%E4%B8%8B%E8%BD%BDPDF%E9%99%84%E4%BB%B6-2.pdf](https://prod-files-secure.s3.us-west-2.amazonaws.com/6c096b44-beb9-48ee-8f92-1efdde47f3a3/69f6fdf6-9aab-485a-a73d-d5c0d3f324db/%E4%B8%8B%E8%BD%BDPDF%E9%99%84%E4%BB%B6-2.pdf)

## 5. Photo Gallery

> 💡 This is a picture.

> （内嵌数据库，未导出）

## 6. Embedded Web Page

## 7.Embedded Video

## 8.TODO

Project 1

- [ ] TODO 1
- [ ] TODO 2
Project 2

- [ ] TODO 1
- [ ] TODO 2
## 9.Collapsed List

- Click to Expand
  - Click to Expand
    - Click to Expand
      内容可以多级嵌套

---

## 10. **Synchronization Blocks**

Notion supports synchronizing blocks from different pages, known as SyncBlocks. Below are blocks from another page:

> 💡 注意 ： 同步块的使用条件是源页面也要被**开放共享** ，否则NotionNext将无权访问，页面上会被忽略渲染。

# 11.Multi-level Directory

Heading titles automatically converted into a table of contents in the blog.

## Subdirectory Level 1

content 1

## Subdirectory Level 2

content 2

## Subdirectory Level 3

### Subdirectory Level 3.1

Different levels of headings represent different levels of directory.

### Subdirectory Level 3.2

Higher-level directory nesting lower-level directories

## **Multi-level Lists**

- Inevitability of Things
1. Things change according to certain laws, and there is also an inevitable nature to them. This nature is called **inevitability**.
  1. The inevitability of things is the nature of the things themselves (our opposition to fatalism lies in the fact that it believes everything is controlled by the gods, rather than opposing the fact that there are inevitable qualities in the development of things).
    1. Third-level list
    1. Third-level list
  1. It is determined by the development of the thing itself and the surrounding conditions.
    1. Third-level list
      1. Third-level list
# **Template Usage Instructions**

To deploy your NotionNext project, please copy this template and create articles according to the template format.

[Notion Blog - EN | Notion](/images/notion/f74782a14f527228e5b8.jpg)

[Notion 博客 | Notion](https://tanghh.notion.site/02ab3b8678004aa69e9e415905ef32a5?v=b7eb215720224ca5827bfaa5ef82cf2d)

# **Comment Plugin**

The system supports six comment plugins: Waline, Giscus, Valine, GitTalk, Utterance, Cusdis, and Twikoo. You can enable them simultaneously and switch between them by clicking on the tabs in the comment section.

Follow the instructions below to enable the desired comment plugin.

[NotionNext配置评论插件Twikoo | TANGLY's BLOG](https://tangly1024.com/article/notionnext-twikoo)

[NotionNext如何添加评论插件 | TANGLY's BLOG](https://tangly1024.com/article/notion-next-comment-plugin)

[NotionNext配置Valine/Waline评论插件 | TANGLY's BLOG](https://tangly1024.com/article/notionnext-valine)

# **References**

### [1. About Li Bai](https://en.wikipedia.org/wiki/Li_Bai)

Citation of another article → [Introduction](/images/notion/3eb2053315524d5c25bb.jpg)
