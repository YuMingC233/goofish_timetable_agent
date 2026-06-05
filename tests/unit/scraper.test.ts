import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrapeChat } from '../../src/content/scraper';

/** Mimics goofish.com seller workspace actual DOM structure (CSS Modules with hashed suffixes). */
function setupChatDOM(): HTMLElement {
  document.body.innerHTML = `
    <div id="J_AppMain">
      <div class="message-topbar--HhzSVLhZ">
        <div class="text-container--wniQlGNw">
          <span class="text1--RdXSNECh">Se7eN丶丶</span>
          <span class="text2--MQGwX_k2">(z***q)</span>
        </div>
      </div>
      <div id="message-list-scrollable">
        <div id="msg-list-container">
          <div class="ant-spin-nested-loading">
            <div class="ant-spin-container">
              <ul class="ant-list-items">
                <!-- wrapper div: date sep + buyer message (nested like real page) -->
                <div style="position: relative; z-index: 99;">
                  <div style="text-align: center; padding: 10px 0px; color: rgb(153, 153, 153); font-size: 12px;">06-03 21:50</div>
                  <div data-before-current-y="-1670">
                    <div>
                      <li class="ant-list-item" style="direction: ltr; text-align: left;">
                        <div class="message-row--pIWaXNhZ">
                          <div style="display: flex; flex-direction: row; width: 100%;">
                            <div style="display: flex; flex-direction: column; flex: 1 1 0%; align-items: flex-start;">
                              <div style="font-size: 12px; color: rgb(102, 102, 102); margin-bottom: 4px;">
                                <span style="white-space: nowrap;">Se7eN丶丶</span>
                              </div>
                              <div class="ant-dropdown-trigger message-content--kBUbolyy">
                                <div>
                                  <div class="message-text--zV88pB7N message-text-left--Wvuv8NsL">
                                    <span>这个能做吗？周五前要</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </div>
                  </div>
                </div>

                <!-- wrapper div: seller message (no date sep inside) -->
                <div style="position: relative; z-index: 99;">
                  <div data-before-current-y="-1467.5">
                    <div>
                      <li class="ant-list-item" style="direction: rtl; text-align: right;">
                        <div class="message-row--pIWaXNhZ">
                          <div style="display: flex; flex-direction: row-reverse; width: 100%;">
                            <div style="display: flex; flex-direction: column; flex: 1 1 0%; align-items: flex-start;">
                              <div style="font-size: 12px; color: rgb(102, 102, 102); margin-bottom: 4px;">
                                <span style="white-space: nowrap;">写程序高手Connor</span>
                              </div>
                              <div class="ant-dropdown-trigger message-content--kBUbolyy">
                                <div>
                                  <div class="message-text--zV88pB7N message-text-right--Vhy6k0cY">
                                    <span>可以，加急加50</span>
                                  </div>
                                </div>
                                <div class="read-status-text--cOgwxbrg ">已读</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </div>
                  </div>
                </div>

                <!-- system message: withdraw (direct li child, no wrapper) -->
                <li class="ant-list-item" style="display: flex; justify-content: center; align-items: center;">
                  <div class="withdraw--RXvse0es">
                    <span class="msg-withdraw--jTZttpHk">你撤回了一条消息</span>
                  </div>
                </li>

                <!-- wrapper div: date sep + buyer message -->
                <div style="position: relative; z-index: 99;">
                  <div style="text-align: center; padding: 10px 0px; color: rgb(153, 153, 153); font-size: 12px;">昨天 10:05</div>
                  <div data-before-current-y="-1313.5">
                    <div>
                      <li class="ant-list-item" style="direction: ltr; text-align: left;">
                        <div class="message-row--pIWaXNhZ">
                          <div style="display: flex; flex-direction: row; width: 100%;">
                            <div style="display: flex; flex-direction: column; flex: 1 1 0%; align-items: flex-start;">
                              <div style="font-size: 12px; color: rgb(102, 102, 102); margin-bottom: 4px;">
                                <span style="white-space: nowrap;">Se7eN丶丶</span>
                              </div>
                              <div class="ant-dropdown-trigger message-content--kBUbolyy">
                                <div>
                                  <div class="message-text--zV88pB7N message-text-left--Wvuv8NsL">
                                    <span>OK 拍了</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </div>
                  </div>
                </div>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  return document.body;
}

vi.stubGlobal('location', { href: 'https://www.goofish.com/im?userId=114739358' });

describe('scrapeChat', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts buyer name from chat header', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.buyerName).toBe('Se7eN丶丶');
  });

  it('extracts only real chat messages (skips date-separators and system messages)', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.messages).toHaveLength(3);
  });

  it('correctly identifies buyer vs seller from CSS Module classes', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.messages[0]).toEqual({
      sender: 'buyer',
      content: '这个能做吗？周五前要',
      timestamp: '06-03 21:50',
    });
    expect(result.messages[1]).toEqual({
      sender: 'seller',
      content: '可以，加急加50',
      timestamp: '06-03 21:50',
    });
    expect(result.messages[2]).toEqual({
      sender: 'buyer',
      content: 'OK 拍了',
      timestamp: '昨天 10:05',
    });
  });

  it('extracts chat URL', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.chatUrl).toBe('https://www.goofish.com/im?userId=114739358');
  });

  it('returns empty buyer name when chat container not found', () => {
    document.body.innerHTML = '<div>No chat here</div>';
    const result = scrapeChat();
    expect(result.buyerName).toBe('');
    expect(result.messages).toHaveLength(0);
  });

  it('returns empty messages array when no messages exist', () => {
    document.body.innerHTML = `
      <div id="J_AppMain">
        <div class="message-topbar--HhzSVLhZ">
          <div class="text-container--wniQlGNw">
            <span class="text1--RdXSNECh">李四</span>
          </div>
        </div>
        <div id="msg-list-container">
          <ul class="ant-list-items"></ul>
        </div>
      </div>
    `;
    const result = scrapeChat();
    expect(result.buyerName).toBe('李四');
    expect(result.messages).toHaveLength(0);
  });
});
