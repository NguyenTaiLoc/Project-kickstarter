import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Container, Card, ListGroup } from 'react-bootstrap';
import { CSSTransition } from 'react-transition-group';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import './transitions.css';

const SocketComponent = () => {
  const [moneyBackerTitleInfo, setMoneyBackerTitleInfo] = useState({
    title: 'KickStarter Project',
    backer: 0,
    money: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = io('http://localhost:3005', {
      withCredentials: true,
    });

    socket.on('moneyBackerTitleInfo', (data) => {
      setMoneyBackerTitleInfo(data);
      setLoading(false);
    });

    socket.on('error', (errorMessage) => {
      setError(errorMessage);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Container fluid className="full-height d-flex justify-content-center align-items-center">
      <Card className="socket-container text-center">
        <div className="info-container">
          <Card.Title className="title mb-4">{moneyBackerTitleInfo.title}</Card.Title>
          
          <CSSTransition
            in={!loading}
            timeout={300}
            classNames="fade"
            unmountOnExit
            style={{
              transitionTimingFunction: 'ease-in-out',
              transitionDuration: '300ms',
            }}
          >
            <ListGroup variant="flush">
              <div className="loading-placeholder">
                <div className="placeholder-line mb-3 placeholder-rectangle">
                  Pledged Money: {moneyBackerTitleInfo.money}
                </div>
                <div className="placeholder-line placeholder-rectangle">
                  Number of Backers: {moneyBackerTitleInfo.backer}
                </div>
              </div>
            </ListGroup>
          </CSSTransition>
          
          {loading && (
            <div className="loading-placeholder">
              <div className="placeholder-line mb-3 placeholder-rectangle">Pledged Money: 0</div>
              <div className="placeholder-line placeholder-rectangle">Number of Backers: 0</div>
            </div>
          )}
        </div>
      </Card>
    </Container>
  );
};

export default SocketComponent;
