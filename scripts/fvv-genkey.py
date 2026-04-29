#!/usr/bin/env python3
"""FVV 计算器秘钥生成器"""
import hashlib, json, secrets, time, sys

def gen_key(expiry_days=7):
    token = secrets.token_hex(16)  # 32 hex chars
    key = f'FVV-{token[:8].upper()}-{token[8:16].upper()}-{token[16:24].upper()}'
    expires = int(time.time()) + expiry_days * 86400
    expiry_str = time.strftime('%Y-%m-%d %H:%M', time.localtime(expires))
    # Store as: { key: <plain>, expires: <timestamp>, hash: sha256(key) }
    return {
        'key': key,
        'expires': expires,
        'expires_str': expiry_str,
        'remaining_days': expiry_days,
    }

if __name__ == '__main__':
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    data = gen_key(days)
    print(json.dumps(data, indent=2))
    print(f'\n📋 复制下面这段到侧边栏JS的 AUTH 常量:')
    print(f'const FVV_AUTH = {{ key: "{data["key"]}", expires: {data["expires"]} }};')
