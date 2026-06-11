package sneak_shop.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;
import sneak_shop.enums.UserStatus;
import sneak_shop.repository.UserRepository;
import sneak_shop.security.JwtService;

import java.util.Map;

@Component
public class RealtimeWebSocketAuthInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public RealtimeWebSocketAuthInterceptor(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("token");
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            Integer userId = Integer.valueOf(jwtService.getSubject(token));
            var user = userRepository.findById(userId)
                    .filter(u -> Boolean.TRUE.equals(u.getEnabled()))
                    .filter(u -> u.getDeletedAt() == null && u.getStatus() == UserStatus.active)
                    .orElse(null);
            if (user == null) {
                return false;
            }
            attributes.put("userId", user.getId());
            attributes.put("role", user.getRole().name());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}
